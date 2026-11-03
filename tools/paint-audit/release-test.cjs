'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {blogContract}=require('./release-contract.cjs');
test('release page contract rejects a pre-fix navbar and accepts compressed fixed markup',()=>{
 assert.ok(Object.values(blogContract('blog-page','<button hidden><span class="theme-label"> Dark</span></button>')).some(v=>!v));
 const html=`<span class="theme-label"> Theme</span><script>button.setAttribute('data-te-pending-slot', ''); if (typeof window.HTMLDialogElement.prototype.showModal !== 'function') return; input.value = '';</script><link href="/blog/assets/css/tront-theme-bridge.css">`;
 assert.ok(Object.values(blogContract('blog-page',html)).every(Boolean));
});
test('release CSS contract requires hidden slot, transparent search, no tween and focus ring',()=>{
 const css=`#tront-theme-btn[hidden][data-te-pending-slot] { display: flex !important; visibility: hidden; pointer-events: none;} #search-input {background: transparent; transition: none;} #search:focus-within {outline: 2px solid var(--te-accent);}`;
 assert.ok(Object.values(blogContract('blog-css',css)).every(Boolean));
 assert.equal(blogContract('blog-css',css.replace('transition: none;','transition: all .3s;')).searchNoTween,false);
});
