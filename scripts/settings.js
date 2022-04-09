const form = document.getElementById("setting-form");

form.onsubmit = (e) => {
  e.preventDefault();

  const { elements } = document.forms["setting-form"];
  console.log("elements", elements);

  alert(`Number of word - ${elements.words.value}\n
  Round time - (seconds) - ${elements.seconds.value}\n
  Pass fine - ${elements.pass.value}`);

  window.localStorage.setItem("roundTime", elements.seconds.value);
  window.location.href = "../html/wordset.html";
};
