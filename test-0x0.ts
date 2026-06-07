import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';

async function test0x0() {
  const form = new FormData();
  form.append('file', fs.createReadStream('test.png'));
  
  try {
    const res = await axios.post('https://0x0.st', form, {headers: form.getHeaders()});
    console.log("URL:", res.data);
  } catch (e) {
    console.error(e.response ? e.response.data : e.message);
  }
}
test0x0();
