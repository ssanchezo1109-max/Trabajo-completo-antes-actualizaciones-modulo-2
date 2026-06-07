import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';

async function testImgur() {
  const base64Data = fs.readFileSync('tv_test.png', 'base64');
  const form = new FormData();
  form.append('image', base64Data);
  form.append('type', 'base64');
  
  try {
    const res = await axios.post('https://api.imgur.com/3/image', form, {
      headers: {
        ...form.getHeaders(),
        Authorization: 'Client-ID 546c25a59c58ad7'
      }
    });
    console.log("URL:", res.data.data.link);
  } catch (e) {
    console.error(e.response ? e.response.data : e.message);
  }
}
testImgur();
