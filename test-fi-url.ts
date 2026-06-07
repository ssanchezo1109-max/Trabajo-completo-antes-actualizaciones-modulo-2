import axios from 'axios';
import fs from 'fs';

async function testFIUrl() {
  const base64Data = fs.readFileSync('test.png', 'base64');
  const params = new URLSearchParams();
  params.append('key', '6d207e02198a847aa98d0a2a901485a5');
  params.append('action', 'upload');
  params.append('source', base64Data);
  params.append('format', 'json');
  
  try {
    const res = await axios.post('https://freeimage.host/api/1/upload', params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    console.log(res.data.image.url);
  } catch (e) {
    console.error(e.response ? e.response.data : e.message);
  }
}
testFIUrl();
