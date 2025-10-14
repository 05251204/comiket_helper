const url = "https://x.com/ALTER7357/status/1977670575243055309";

const responce = await fetch(url);
const text = await responce.text();
//console.log(text);

const keyword = 'twimg';
const first="https";
const last=".png";
const regex = new RegExp(`${first}[^"]*${keyword}[^"]*${last}`, 'g');
const matches = text.match(regex);

console.log(matches); 