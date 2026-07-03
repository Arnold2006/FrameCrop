/**
 * reset.js – Remove node_modules so the user can reinstall fresh
 */
module.exports = {
  run: [
    {
      method: "shell.run",
      params: {
        message: "node -e \"const fs=require('fs');const p=require('path');['node_modules','package-lock.json'].forEach(f=>{const fp=p.resolve(f);try{fs.rmSync(fp,{recursive:true,force:true})}catch(e){}});console.log('Cleaned')\"",
      },
    },
    {
      method: "notify",
      params: {
        html: "🗑️ <b>FrameCrop</b> dependencies removed. Click <b>Install</b> to reinstall.",
      },
    },
  ],
};
