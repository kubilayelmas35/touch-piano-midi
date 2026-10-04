// Shows the Turkish or English half of a legal page: #tr / #en in the URL, otherwise the browser language.
(function () {
  function pick() {
    var hash = location.hash.slice(1);
    var nav = (navigator.languages && navigator.languages[0]) || navigator.language || "en";
    var lang = hash === "tr" || hash === "en" ? hash : nav.toLowerCase().indexOf("tr") === 0 ? "tr" : "en";
    document.documentElement.lang = lang;
    document.querySelectorAll("section[lang]").forEach(function (s) {
      s.classList.toggle("on", s.getAttribute("lang") === lang);
    });
    document.querySelectorAll(".langs a").forEach(function (a) {
      a.classList.toggle("on", a.getAttribute("href") === "#" + lang);
    });
    var title = document.querySelector("section.on h1");
    if (title) document.title = title.textContent + " — Sonatrio";
  }
  window.addEventListener("hashchange", pick);
  pick();
})();
