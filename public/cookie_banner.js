let banner_div = document.querySelector(".alert-cookie");
let cookie_accept_button = document.querySelector(".alert-cookie .cookie-accept");
let cookie_decline_button = document.querySelector(".alert-cookie .cookie-decline")

try {
    const cookieValue = document.cookie.replace(
        /(?:(?:^|.*;\s*)banner\s*\=\s*([^;]*).*$)|^.*$/,
        "$1"
    );

    if (!(cookieValue === "accepted" || cookieValue === "declined")) banner_div.style.display = "block";
} catch (e) {
    console.log("checkAccepted error");
    console.log(e);
}

cookie_accept_button.addEventListener("click", e => {
    banner_div.style.display = "none";
    document.cookie = "banner=accepted; max-age=" + 60 * 60 * 24 * 365;
    matomoTrackingScript();
});

cookie_decline_button.addEventListener("click", e => {
    banner_div.style.display = "none";
    document.cookie = "banner=declined; max-age=" + 60 * 60 * 24 * 365;
})

function matomoTrackingScript() {
    var _paq = window._paq = window._paq || [];
    /* tracker methods like "setCustomDimension" should be called before "trackPageView" */
    _paq.push(['trackPageView']);
    _paq.push(['enableLinkTracking']);
    (function() {
        var u="https://digital.matomo.cloud/";
        _paq.push(['setTrackerUrl', u+'matomo.php']);
        _paq.push(['setSiteId', '7']);
        var d=document, g=d.createElement('script'), s=d.getElementsByTagName('script')[0];
        g.async=true; g.src='//cdn.matomo.cloud/digital.matomo.cloud/matomo.js'; s.parentNode.insertBefore(g,s);
    })();
}