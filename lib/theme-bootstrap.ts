export const THEME_BOOTSTRAP =
  '(function(){try{var p=null;var raw=localStorage.getItem("csmon.options");if(raw)p=JSON.parse(raw).palette;var dark=p==="dark"||(p!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);if(dark){document.documentElement.classList.add("dark");document.documentElement.style.colorScheme="dark";}}catch(e){}})();';
