const teams = document.getElementById("teams");
const addBtn = document.getElementById("team-create");
const firstBtnDelete = document.getElementById("delete-1");
const secondBtnDelete = document.getElementById("delete-2");

let defaultTeamsCount = 2;
let count = 2;

function deleteTeam(e, team) {
  if (count <= 2)
    return;
  count -= 1;
  const deletedTeam = document.getElementById(`team-${team}`);
  deletedTeam.remove();
}

firstBtnDelete.onclick = (e) => deleteTeam(e, 1);
secondBtnDelete.onclick = (e) => deleteTeam(e, 2);

addBtn.onclick = () => {
  defaultTeamsCount += 1;
  count += 1;
  let teamsCount = defaultTeamsCount;
  const team = document.createElement("div");
  team.classList.add("teams-field__item");
  team.id = `team-${teamsCount}`;

  team.innerHTML = `<span>Team ${teamsCount}</span>
                    <button id="delete-${teamsCount}" class="teams-field__item-btn">
                      <img src="../images/cross.svg" alt="">
                    </button>`;

  teams.appendChild(team);
  const deleteBtn = document.getElementById(`delete-${teamsCount}`);
  deleteBtn.onclick = (e) => deleteTeam(e, teamsCount);
};

window.addEventListener("unload", function () {
  window.localStorage.setItem("teamsCount", count);
});
