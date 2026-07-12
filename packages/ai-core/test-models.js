require('dotenv').config({path: '../../.env'});
const key = process.env.GEMINI_API_KEY;
if (!key) {
  console.log('No GEMINI_API_KEY found');
  process.exit(1);
}
fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + key)
  .then(r => r.json())
  .then(j => {
    if (j.models) {
      console.log(j.models.map(m => m.name).filter(n => n.includes('embed')));
    } else {
      console.log('Error:', j);
    }
  })
  .catch(console.error);
