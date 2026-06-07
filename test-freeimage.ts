import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

async function testFreeImage() {
  try {
    const form = new FormData();
    form.append('key', '6d207e02198a847aa98d0a2a901485a5');
    form.append('action', 'upload');
    const base64Data = fs.readFileSync('test.png', {encoding: 'base64'});
    form.append('source', base64Data);
    form.append('format', 'json');
    const res = await axios.post('https://freeimage.host/api/1/upload', form, {headers: form.getHeaders()});
    console.log("FreeImage URL:", res.data.image.url);
  } catch (e: any) {
    console.error("FreeImage error:", e.response?.data || e.message);
  }
}
testFreeImage();
