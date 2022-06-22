var banner_div = document.querySelector(".alert-cookie");
var banner_button = document.querySelector(".alert-cookie .button");

try {
    var cookieValue = document.cookie.replace(
        /(?:(?:^|.*;\s*)banner\s*\=\s*([^;]*).*$)|^.*$/,
        "$1"
    );

    if (cookieValue !== "accepted") banner_div.style.display = "block";
} catch (e) {
    console.log("checkAccepted error");
    console.log(e);
}

banner_button.addEventListener("click", e => {
    banner_div.style.display = "none";
    document.cookie = "banner=accepted; max-age=" + 60 * 60 * 24 * 365;
});