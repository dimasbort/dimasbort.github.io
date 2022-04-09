const teamList = document.getElementById("list");

document.addEventListener("DOMContentLoaded", () => {
  const count = window.localStorage.getItem("teamsCount");

    new Array(parseInt(count)).fill(1).map((_, index) => {
      console.log("index", index);
      const team = document.createElement("li");
      team.classList.add("rating__list-item");
      team.innerHTML = `Team ${index + 1}: <span>0</span>`;

      console.log("team", team);

      teamList.appendChild(team);
    });
});
