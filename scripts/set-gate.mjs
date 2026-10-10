import {readFile,writeFile} from "node:fs/promises";
import {pbkdf2Sync,randomBytes,createCipheriv,createDecipheriv} from "node:crypto";
let raw="";for await(const chunk of process.stdin)raw+=chunk;
const {code,destination}=JSON.parse(raw);
const target=new URL(destination);
if(typeof code!=="string"||!code.trim()||target.href!=="https://shaiolssss.github.io/shaiol/logs/")throw new Error("Invalid input");
const salt=randomBytes(16),iv=randomBytes(12),iterations=450000,key=pbkdf2Sync(code.trim(),salt,iterations,32,"sha256");
const cipher=createCipheriv("aes-256-gcm",key,iv),plain=JSON.stringify({destination});
const encrypted=Buffer.concat([cipher.update(plain,"utf8"),cipher.final()]),tag=cipher.getAuthTag();
await writeFile(new URL("../public/assets/gate.json",import.meta.url),JSON.stringify({version:1,iterations,salt:salt.toString("base64"),iv:iv.toString("base64"),ciphertext:Buffer.concat([encrypted,tag]).toString("base64")},null,2));
const decipher=createDecipheriv("aes-256-gcm",key,iv);decipher.setAuthTag(tag);
if(Buffer.concat([decipher.update(encrypted),decipher.final()]).toString()!==plain)throw new Error("Round trip failed");
console.log("Gate configured and verified. No plaintext code saved.");

