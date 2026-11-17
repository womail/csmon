/** Shows the header notice if the client has not marked the page ready. */
export const CLIENT_BOOT =
  '(function(){window.setTimeout(function(){if(document.documentElement.getAttribute("data-csmon")==="ready")return;var el=document.getElementById("csmon-boot");if(el)el.hidden=false;},4000);})();';
