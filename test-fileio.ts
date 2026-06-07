import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

async function testFileIo() {
  try {
    const form = new FormData();
    form.append('file', fs.createReadStream('tv_test.png'));
    const res = await axios.post('https://file.io', form, {headers: form.getHeaders()});
    console.log("file.io URL:", res.data);
  } catch (e: any) {
    console.error("file.io error:", e.response?.data || e.message);
  }
}
testFileIo();
