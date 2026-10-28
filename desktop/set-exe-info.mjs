/* Dustline desktop - set-exe-info.mjs: gives the Windows executable Dustline's icon and file details.
 * build-windows.sh runs it with Node.js and the resedit library (the same one Electron Packager uses).
 * Usage: node set-exe-info.mjs <Dustline.exe> <icon.ico> <version> */
import * as fs from 'node:fs';
import * as PELibrary from 'pe-library';
import * as ResEdit from 'resedit';

const [exePath, icoPath, version] = process.argv.slice(2);
// Electron's own executable is signed; the edited copy is written unsigned.
const exe = PELibrary.NtExecutable.from(fs.readFileSync(exePath), { ignoreCert: true });
const res = PELibrary.NtExecutableResource.from(exe);

const group = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries)[0];
if (!group) throw new Error('No icon found in ' + exePath);
const icons = ResEdit.Data.IconFile.from(fs.readFileSync(icoPath)).icons.map((icon) => icon.data);
ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, group.id, group.lang, icons);

const info = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0];
const lang = info.getAllLanguagesForStringValues()[0];
info.setFileVersion(version + '.0', lang.lang);
info.setProductVersion(version + '.0', lang.lang);
info.setStringValues(lang, {
  FileDescription: 'Dustline',
  ProductName: 'Dustline',
  CompanyName: 'The Dustline contributors',
  LegalCopyright: 'MIT License',
  InternalName: 'Dustline',
  OriginalFilename: 'Dustline.exe',
});
info.outputToResourceEntries(res.entries);

res.outputResource(exe);
fs.writeFileSync(exePath, Buffer.from(exe.generate()));
console.log('Set the Dustline icon and file details on ' + exePath);
