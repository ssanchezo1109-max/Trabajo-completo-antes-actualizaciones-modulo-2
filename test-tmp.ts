import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

async function testTmp() {
  if (!fs.existsSync('test.png')) {
    fs.writeFileSync('test.png', 'fake image data for testing');
  }
  const form = new FormData();
  form.append('file', fs.createReadStream('test.png'));
  try {
    const res = await axios.post('https://tmpfiles.org/api/v1/upload', form, {headers: form.getHeaders()});
    console.log("Response:", res.data);
  } catch (e) {
    console.log("Error:", e.message);
  }
}
testTmp();
