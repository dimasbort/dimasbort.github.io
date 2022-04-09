const { documentElement } = document;

const circle = document.getElementById("alias-word");
const guessedWords = document.getElementById("guessed");
const skippedWords = document.getElementById("skipped");
const timer = document.getElementById("timer");

const rightLimit = documentElement.clientWidth * 0.9;
const leftLimit = documentElement.clientWidth * 0.1;

let startSeconds = window.localStorage.getItem("roundTime") || 30;
console.log("startSeconds", startSeconds);

document.addEventListener("DOMContentLoaded", () => {
  setInterval(() => {
    if (startSeconds === 1) {
      window.location.href = "../html/result.html";
    }
    startSeconds -= 1;
    timer.textContent = `${new Date(0, 0, 0, 0, 0, startSeconds).toLocaleString(
      "ru",
      {
        minute: "numeric",
        second: "numeric",
      }
    )}`;
  }, 1000);
});

circle.onmousedown = function (event) {
  let shiftX = event.clientX - circle.getBoundingClientRect().left;

  circle.style.position = "absolute";
  circle.style.zIndex = 1000;

  function onMouseMove(event) {
    if (circle.getBoundingClientRect().right > rightLimit) {
      return;
    }

    if (circle.getBoundingClientRect().left < leftLimit) {
      return;
    }

    circle.style.left = event.pageX - shiftX + "px";
  }

  document.addEventListener("mousemove", onMouseMove);

  document.body.onmouseup = function (e) {
    document.removeEventListener("mousemove", onMouseMove);
    circle.style.position = "static";
    circle.style.left = "unset";

    if (e.pageX > documentElement.clientWidth * 0.5) {
      skippedWords.textContent = `${+skippedWords.textContent + 1}`;
    }

    if (e.pageX < documentElement.clientWidth * 0.5) {
      guessedWords.textContent = `${+guessedWords.textContent + 1}`;
    }
  };
};
