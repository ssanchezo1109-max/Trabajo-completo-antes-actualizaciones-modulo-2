import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

async function testCatbox() {
  try {
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('fileToUpload', fs.createReadStream('tv_test.png'));
    const res = await axios.post('https://catbox.moe/user/api.php', form, {headers: form.getHeaders()});
    console.log("Catbox URL:", res.data);
  } catch (e: any) {
    console.error("Catbox error:", e.message);
  }
}
testCatbox();
