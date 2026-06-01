const API = window.BARBERSHOP_API_URL
  || (isLocalHost(window.location.hostname)
    ? `http://${window.location.hostname || "localhost"}:4000/api`
    : isProductionHost(window.location.hostname)
      ? "https://api.andreipalych.by/api"
    : `${window.location.origin}/api`);
const BARBERSHOP_TIME_ZONE = "Europe/Minsk";
const JOURNAL_START_HOUR = 8;
const JOURNAL_END_HOUR = 21;
const JOURNAL_HOUR_HEIGHT = 190;
const BREAK_PHONE = "__BREAK__";
let token = localStorage.getItem("ap_admin_token") || "";
let allSpecialists = [];
let allServices = [];
const weekdays = ["mon","tue","wed","thu","fri","sat","sun"];
let journalDate = getBarbershopDateString(new Date());
let appointmentSlotDate = getBarbershopDateString(new Date());
let selectedAppointmentSlot = "";
let clientsSearchTimer = null;
let scheduleDateRecords = [];
let appointmentFixedSlot = null;
let appointmentMaxDuration = null;
let selectedJournalSlot = null;

function isLocalHost(hostname) {
  return ["localhost", "127.0.0.1", ""].includes(hostname)
    || /^192\.168\./.test(hostname)
    || /^10\./.test(hostname)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);
}

function isProductionHost(hostname) {
  return hostname === "andreipalych.by" || hostname === "www.andreipalych.by";
}

// ── Инициализация ──────────────────────────────────────────────────

window.addEventListener("DOMContentLoaded", () => {
  if (token) {
    showMain();
  }
});

// ── Авторизация ────────────────────────────────────────────────────

async function doLogin() {
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value.trim();
  const errEl = document.getElementById("login-error");

  try {
    const res = await api("POST", "/admin/login", { username, password }, false);
    token = res.token;
    localStorage.setItem("ap_admin_token", token);
    errEl.style.display = "none";
    showMain();
  } catch (e) {
    errEl.textContent = "Неверный логин или пароль";
    errEl.style.display = "block";
  }
}

function doLogout() {
  token = "";
  localStorage.removeItem("ap_admin_token");
  toggleAdminMenu(false);
  document.getElementById("screen-main").classList.remove("active");
  document.getElementById("screen-login").classList.add("active");
}

async function showMain() {
  document.getElementById("screen-login").classList.remove("active");
  document.getElementById("screen-main").classList.add("active");

  // Загружаем базовые данные
  allSpecialists = await api("GET", "/admin/specialists");
  allServices = await api("GET", "/admin/services");

  // Заполняем базовые селекты
  const scheduleSel = document.getElementById("schedule-specialist");
  scheduleSel.innerHTML = `<option value="">Выберите специалиста</option>`;
  allSpecialists.forEach(s => {
    scheduleSel.innerHTML += `<option value="${s.id}">${s.name}</option>`;
  });

  showPage("appointments");
}

// ── Навигация ──────────────────────────────────────────────────────

function showPage(name) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  document.getElementById(`page-${name}`).classList.add("active");
  document.querySelector(`[data-page="${name}"]`).classList.add("active");
  toggleAdminMenu(false);

  if (name === "appointments") loadAppointments();
  if (name === "specialists") loadSpecialistsList();
  if (name === "services") loadServicesList();
  if (name === "clients") loadClients();
}

function toggleAdminMenu(force) {
  const main = document.getElementById("screen-main");
  if (!main) return;
  const shouldOpen = typeof force === "boolean" ? force : !main.classList.contains("menu-open");
  main.classList.toggle("menu-open", shouldOpen);
  document.body.classList.toggle("admin-menu-open", shouldOpen);
}

// ── Записи ─────────────────────────────────────────────────────────

async function loadAppointments() {
  const input = document.getElementById("journal-date");
  if (input) input.value = journalDate;
  const label = document.getElementById("journal-date-label");
  if (label) {
    const dt = createLocalDate(journalDate);
    label.textContent = dt.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }

  const rows = await api("GET", `/admin/appointments?date=${journalDate}`);
  const el = document.getElementById("appointments-list");
  if (!allSpecialists.length) {
    el.innerHTML = `<div class="empty-state">Добавьте специалистов, чтобы увидеть журнал</div>`;
    return;
  }

  const now = new Date();
  const hours = Array.from({ length: JOURNAL_END_HOUR - JOURNAL_START_HOUR + 1 }, (_, i) => JOURNAL_START_HOUR + i);
  const timelineHeight = (JOURNAL_END_HOUR - JOURNAL_START_HOUR) * JOURNAL_HOUR_HEIGHT;

  el.innerHTML = `
    <div class="journal-scroll">
      <div class="journal-grid" style="--specialists:${allSpecialists.length};--half-hour-height:${JOURNAL_HOUR_HEIGHT / 2}px">
        <div class="time-head"></div>
        ${allSpecialists.map(s => `
          <div class="specialist-head">
            <img src="${resolveAssetUrl(s.photo)}" onerror="this.style.display='none'">
            <span>${escapeHtml(s.name)}</span>
          </div>
        `).join("")}
        <div class="time-rail" style="height:${timelineHeight}px">
          ${hours.slice(0, -1).map(hour => `
            <div class="time-mark" style="top:${(hour - JOURNAL_START_HOUR) * JOURNAL_HOUR_HEIGHT}px">${String(hour).padStart(2, "0")}:00</div>
          `).join("")}
        </div>
        ${allSpecialists.map(s => `
          <div class="journal-column" style="height:${timelineHeight}px">
            ${renderJournalFreeSlots(s, rows)}
            ${rows
              .filter(r => r.specialistId === s.id)
              .map(r => renderJournalAppointment(r, now))
              .join("")}
          </div>
        `).join("")}
      </div>
    </div>`;
}

function renderJournalAppointment(row, now) {
  const start = new Date(row.datetime_start);
  const end = new Date(row.datetime_end);
  const isPast = end < now;
  const time = `${formatTime(start)}-${formatTime(end)}`;
  const startMinutes = getMinutesInBarbershopTz(start);
  const endMinutes = getMinutesInBarbershopTz(end);
  const top = ((startMinutes - JOURNAL_START_HOUR * 60) / 60) * JOURNAL_HOUR_HEIGHT;
  const duration = endMinutes - startMinutes;
  const height = Math.max(34, (duration / 60) * JOURNAL_HOUR_HEIGHT - 6);
  const isBreak = row.client_phone === BREAK_PHONE;
  return `
    <div class="journal-appt ${isPast ? "past" : ""} ${isBreak ? "break" : ""}" style="top:${top}px;height:${height}px">
      <div class="journal-appt-time">${time}</div>
      <div class="journal-appt-client">${escapeHtml(isBreak ? "Перерыв" : row.client_name)}</div>
      ${isBreak ? "" : `<div class="journal-appt-phone">${escapeHtml(row.client_phone)}</div>`}
      <div class="journal-appt-service">${escapeHtml(isBreak ? "Время недоступно" : row.Service?.name || "")}</div>
      <button class="journal-delete" onclick="deleteAppointment(${row.id})" title="Удалить">×</button>
    </div>`;
}

function renderJournalFreeSlots(specialist, rows) {
  const slots = [];
  const appointments = rows.filter(row => row.specialistId === specialist.id);
  const intervals = specialist.schedule?.[getWeekdayKeyFromDateString(journalDate)] || [];

  intervals.forEach(interval => {
    const [from, to] = String(interval).split("-");
    const fromMinutes = parseTimeToMinutes(from);
    const toMinutes = parseTimeToMinutes(to);
    if (fromMinutes === null || toMinutes === null) return;

    for (let minute = fromMinutes; minute + 30 <= toMinutes; minute += 30) {
      const slot = createBarbershopDateTime(journalDate, minutesToTime(minute));
      if (slot <= new Date()) continue;

      const slotEnd = new Date(slot.getTime() + 30 * 60000);
      const busy = appointments.some(row => {
        const start = new Date(row.datetime_start);
        const end = new Date(row.datetime_end);
        return start < slotEnd && end > slot;
      });
      if (busy) continue;

      const freeMinutes = getFreeMinutesForSlot(specialist.id, slot, rows);
      if (freeMinutes < 30) continue;

      const top = ((minute - JOURNAL_START_HOUR * 60) / 60) * JOURNAL_HOUR_HEIGHT;
      slots.push(`
        <button
          type="button"
          class="journal-free-slot"
          style="top:${top}px;height:${JOURNAL_HOUR_HEIGHT / 2}px"
          onclick="openJournalSlotModal(${specialist.id}, '${slot.toISOString()}', ${freeMinutes})"
          title="Создать запись или перерыв"
        ></button>`);
    }
  });

  return slots.join("");
}

function openJournalSlotModal(specialistId, slotIso, freeMinutes) {
  const specialist = allSpecialists.find(s => s.id === Number(specialistId));
  const slotDate = new Date(slotIso);
  selectedJournalSlot = { specialistId: Number(specialistId), slotIso, freeMinutes };
  document.getElementById("journal-slot-title").textContent = "Свободное время";
  document.getElementById("journal-slot-summary").innerHTML = `
    <div><strong>${escapeHtml(specialist?.name || "")}</strong></div>
    <div>${formatDateRu(slotDate)} · ${formatTime(slotDate)}</div>
    <div>Свободно: ${freeMinutes} мин</div>
  `;
  document.getElementById("modal-journal-slot").style.display = "flex";
}

function startAppointmentFromJournalSlot() {
  if (!selectedJournalSlot) return;
  closeModal("modal-journal-slot");
  openAppointmentModal({
    specialistId: selectedJournalSlot.specialistId,
    slotIso: selectedJournalSlot.slotIso,
    maxDuration: selectedJournalSlot.freeMinutes,
  });
}

function openBreakModalFromJournalSlot() {
  if (!selectedJournalSlot) return;
  const slotDate = new Date(selectedJournalSlot.slotIso);
  const specialist = allSpecialists.find(s => s.id === selectedJournalSlot.specialistId);
  const maxDuration = Math.min(selectedJournalSlot.freeMinutes, 180);
  const options = [30, 60, 90, 120, 150, 180].filter(value => value <= maxDuration);
  const durationSelect = document.getElementById("break-duration");

  closeModal("modal-journal-slot");
  document.getElementById("break-summary").innerHTML = `
    <div><strong>${escapeHtml(specialist?.name || "")}</strong></div>
    <div>${formatDateRu(slotDate)} · ${formatTime(slotDate)}</div>
    <div>Максимум: ${selectedJournalSlot.freeMinutes} мин</div>
  `;
  durationSelect.innerHTML = options.map(value => `<option value="${value}">${value} мин</option>`).join("");
  document.getElementById("break-error").style.display = "none";
  document.getElementById("modal-break").style.display = "flex";
}

async function saveBreak() {
  const errEl = document.getElementById("break-error");
  const duration = Number(document.getElementById("break-duration").value);
  errEl.style.display = "none";

  if (!selectedJournalSlot || !duration || duration % 30 !== 0) {
    errEl.textContent = "Выберите время перерыва.";
    errEl.style.display = "block";
    return;
  }

  if (duration > selectedJournalSlot.freeMinutes) {
    errEl.textContent = "Перерыв длиннее свободного промежутка.";
    errEl.style.display = "block";
    return;
  }

  try {
    await api("POST", "/admin/breaks", {
      specialistId: selectedJournalSlot.specialistId,
      datetime_start: new Date(selectedJournalSlot.slotIso).toISOString(),
      duration_min: duration,
    });
    closeModal("modal-break");
    await loadAppointments();
  } catch (err) {
    errEl.textContent = "Не удалось создать перерыв. Проверьте свободное время.";
    errEl.style.display = "block";
  }
}

function setJournalDate(value) {
  if (!value) return;
  journalDate = value;
  loadAppointments();
}

function shiftJournalDate(days) {
  journalDate = shiftDateString(journalDate, days);
  loadAppointments();
}

function goToday() {
  journalDate = getBarbershopDateString(new Date());
  loadAppointments();
}

async function deleteAppointment(id) {
  if (!confirm("Удалить запись?")) return;
  await api("DELETE", `/admin/appointments/${id}`);
  loadAppointments();
}

function openAppointmentModal(options = {}) {
  document.getElementById("appt-details-step").style.display = "block";
  document.getElementById("appt-phone").value = "+375 ";
  document.getElementById("appt-name").value = "";
  document.getElementById("appt-datetime").value = options.slotIso || "";
  document.getElementById("appt-date").value = options.slotIso ? getBarbershopDateString(new Date(options.slotIso)) : "";
  document.getElementById("appt-slots").innerHTML = "";
  document.getElementById("appt-step-summary").innerHTML = "";
  document.getElementById("appt-slot-step").style.display = "none";
  document.getElementById("appt-save-btn").style.display = options.slotIso ? "block" : "none";
  document.getElementById("appt-next-btn").style.display = options.slotIso ? "none" : "block";
  document.getElementById("appt-service-field").style.display = "none";
  document.getElementById("appt-error").style.display = "none";
  selectedAppointmentSlot = options.slotIso || "";
  appointmentFixedSlot = options.slotIso || null;
  appointmentMaxDuration = options.maxDuration || null;
  appointmentSlotDate = options.slotIso ? getBarbershopDateString(new Date(options.slotIso)) : getBarbershopDateString(new Date());

  const specialistSel = document.getElementById("appt-specialist");
  specialistSel.innerHTML = `<option value="">Выберите специалиста</option>`;
  allSpecialists.forEach(s => {
    specialistSel.innerHTML += `<option value="${s.id}">${s.name}</option>`;
  });
  if (options.specialistId) specialistSel.value = String(options.specialistId);
  specialistSel.disabled = Boolean(options.specialistId);
  updateAppointmentServices();

  document.getElementById("modal-appointment").style.display = "flex";
}

function updateAppointmentServices() {
  const specialistId = Number(document.getElementById("appt-specialist").value);
  const serviceSel = document.getElementById("appt-service");
  const serviceField = document.getElementById("appt-service-field");
  const specialist = allSpecialists.find(s => s.id === specialistId);

  serviceSel.innerHTML = `<option value="">Выберите услугу</option>`;
  const services = (specialist?.Services || []).filter(service => {
    const duration = Number(service.SpecialistService?.duration_min || 0);
    return !appointmentMaxDuration || duration <= appointmentMaxDuration;
  });

  services.forEach(service => {
    const link = service.SpecialistService;
    const details = link ? ` · ${link.duration_min} мин · ${link.price} BYN` : "";
    serviceSel.innerHTML += `<option value="${service.id}">${service.name}${details}</option>`;
  });
  if (specialist && !services.length && appointmentMaxDuration) {
    serviceSel.innerHTML += `<option value="" disabled>Нет услуг, которые помещаются в свободное время</option>`;
  }
  serviceField.style.display = specialist ? "block" : "none";
  resetAppointmentSlotSelection();
}

function resetAppointmentSlotSelection() {
  document.getElementById("appt-save-btn").style.display = appointmentFixedSlot ? "block" : "none";
  document.getElementById("appt-next-btn").style.display = appointmentFixedSlot ? "none" : "block";
  selectedAppointmentSlot = appointmentFixedSlot || "";
  document.getElementById("appt-datetime").value = appointmentFixedSlot || "";
}

async function showAppointmentSlots() {
  const errEl = document.getElementById("appt-error");
  errEl.style.display = "none";

  if (!document.getElementById("appt-phone").value.trim()
    || !document.getElementById("appt-specialist").value
    || !document.getElementById("appt-service").value) {
    errEl.textContent = "Заполните телефон, специалиста и услугу.";
    errEl.style.display = "block";
    return;
  }

  const specialist = allSpecialists.find(s => s.id === Number(document.getElementById("appt-specialist").value));
  const service = specialist?.Services?.find(s => s.id === Number(document.getElementById("appt-service").value));
  document.getElementById("appt-step-summary").innerHTML = `
    <div><strong>${escapeHtml(specialist?.name || "")}</strong></div>
    <div>${escapeHtml(service?.name || "")}</div>
    <div>${escapeHtml(document.getElementById("appt-phone").value.trim())}</div>
  `;
  document.getElementById("appt-details-step").style.display = "none";
  document.getElementById("appt-slot-step").style.display = "block";
  document.getElementById("appt-next-btn").style.display = "none";
  document.getElementById("appt-date").value = appointmentSlotDate;
  await loadAppointmentSlots();
}

async function loadAppointmentSlots() {
  const dateInput = document.getElementById("appt-date");
  appointmentSlotDate = dateInput.value || appointmentSlotDate;
  dateInput.value = appointmentSlotDate;
  selectedAppointmentSlot = "";
  document.getElementById("appt-datetime").value = "";
  document.getElementById("appt-save-btn").style.display = "none";

  const slotsEl = document.getElementById("appt-slots");
  slotsEl.innerHTML = `<div class="slot-loading">Загружаем свободное время...</div>`;

  const specialistId = document.getElementById("appt-specialist").value;
  const serviceId = document.getElementById("appt-service").value;
  let data;
  try {
    data = await api("GET", `/admin/available-slots?specialistId=${specialistId}&serviceId=${serviceId}&date=${appointmentSlotDate}`);
  } catch (err) {
    slotsEl.innerHTML = `<div class="empty-state compact">Не удалось загрузить свободное время</div>`;
    return;
  }

  if (!data.slots?.length) {
    slotsEl.innerHTML = `<div class="empty-state compact">Свободного времени на эту дату нет</div>`;
    return;
  }

  slotsEl.innerHTML = data.slots.map(slot => `
    <button class="slot-pill" onclick="selectAppointmentSlot('${slot}')">${formatTime(new Date(slot))}</button>
  `).join("");
}

function backToAppointmentDetails() {
  document.getElementById("appt-details-step").style.display = "block";
  document.getElementById("appt-slot-step").style.display = "none";
  resetAppointmentSlotSelection();
}

async function shiftAppointmentSlotDate(days) {
  appointmentSlotDate = shiftDateString(appointmentSlotDate, days);
  const dateInput = document.getElementById("appt-date");
  if (dateInput) dateInput.value = appointmentSlotDate;
  await loadAppointmentSlots();
}

function selectAppointmentSlot(slot) {
  selectedAppointmentSlot = slot;
  document.getElementById("appt-datetime").value = slot;
  document.querySelectorAll(".slot-pill").forEach(btn => {
    btn.classList.toggle("active", btn.textContent.trim() === formatTime(new Date(slot)));
  });
  document.getElementById("appt-save-btn").style.display = "block";
}

async function saveAppointment() {
  const errEl = document.getElementById("appt-error");
  errEl.style.display = "none";

  const dateValue = selectedAppointmentSlot || document.getElementById("appt-datetime").value;
  const body = {
    client_phone: document.getElementById("appt-phone").value.trim(),
    client_name: document.getElementById("appt-name").value.trim(),
    specialistId: document.getElementById("appt-specialist").value,
    serviceId: document.getElementById("appt-service").value,
    datetime_start: dateValue ? new Date(dateValue).toISOString() : "",
  };

  try {
    await api("POST", "/admin/appointments", body);
    closeModal("modal-appointment");
    await loadAppointments();
  } catch (err) {
    errEl.textContent = "Не удалось создать запись. Проверьте телефон, услугу и время.";
    errEl.style.display = "block";
  }
}

// ── Специалисты ────────────────────────────────────────────────────

async function loadSpecialistsList() {
  const el = document.getElementById("specialists-list");
  el.innerHTML = allSpecialists.map(s => {
    const tags = allServices.map(svc => {
      const linked = s.Services?.find(x => x.id === svc.id);

      if (linked) {
        // Услуга привязана — показываем тег с ценой и кнопкой удаления
        const price = linked.SpecialistService?.price || "";
        const dur   = linked.SpecialistService?.duration_min || "";
        return `
          <span class="service-tag active">
            <span onclick="openSSModal(
              ${s.id},'${s.name}',
              ${svc.id},'${svc.name}',
              ${price},${dur}
            )">${svc.name} · ${price} BYN · ${dur} мин</span>
            <button
              class="tag-delete"
              title="Удалить связь"
              onclick="unlinkService(${s.id}, ${svc.id})"
            >✕</button>
          </span>`;
      } else {
        // Услуга не привязана — серый тег для добавления
        return `
          <span class="service-tag" onclick="openSSModal(
            ${s.id},'${s.name}',
            ${svc.id},'${svc.name}',
            '',''
          )">+ ${svc.name}</span>`;
      }
    }).join("");

    return `
      <div class="item-card">
        <img src="${resolveAssetUrl(s.photo)}" onerror="this.style.display='none'">
        <div class="item-info">
          <div class="item-name">${s.name}</div>
          <div class="item-sub">${s.description || ""}</div>
          <div class="service-tags">${tags}</div>
        </div>
        <div class="item-actions">
          <button class="a-btn small" onclick="openSpecialistModal(${s.id})">✎</button>
          <button class="a-btn small danger" onclick="deleteSpecialist(${s.id})">✕</button>
        </div>
      </div>`;
  }).join("");
}

async function deleteSpecialist(id) {
  const specialist = allSpecialists.find(s => s.id === id);
  const name = specialist?.name || "специалиста";
  if (!confirm(`Удалить ${name}? Если у специалиста есть будущие записи, удаление будет остановлено.`)) return;

  try {
    await api("DELETE", `/admin/specialists/${id}`);
    allSpecialists = await api("GET", "/admin/specialists");
    loadSpecialistsList();
    loadAppointments();
  } catch (err) {
    alert("Не удалось удалить специалиста. Проверьте, нет ли у него будущих записей.");
  }
}

function openSpecialistModal(id) {
  const s = id ? allSpecialists.find(x => x.id === id) : null;
  document.getElementById("modal-specialist-title").textContent = s ? "Редактировать специалиста" : "Добавить специалиста";
  document.getElementById("sp-id").value = s?.id || "";
  document.getElementById("sp-name").value = s?.name || "";
  document.getElementById("sp-photo").value = s?.photo || "";
  document.getElementById("sp-desc").value = s?.description || "";
  document.getElementById("sp-photo-file").value = "";
  updatePhotoPreview(s?.photo || "");

  // Редактор расписания
  const labels = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
  const schedule = s?.schedule || {};
  document.getElementById("sp-schedule-editor").innerHTML = weekdays.map((d, i) => {
    const val = schedule[d]?.[0] || "";
    const [from, to] = val ? val.split("-") : ["",""];
    const [fromH = "", fromM = ""] = from ? from.split(":") : ["", ""];
    const [toH = "", toM = ""] = to ? to.split(":") : ["", ""];
    return `
      <div class="weekday-row">
        <span class="weekday-label">${labels[i]}</span>
        <input id="sch-${d}-from-h" class="time-part" value="${fromH}" placeholder="09" inputmode="numeric" maxlength="2">
        <span>:</span>
        <input id="sch-${d}-from-m" class="time-part" value="${fromM}" placeholder="00" inputmode="numeric" maxlength="2">
        <span>—</span>
        <input id="sch-${d}-to-h" class="time-part" value="${toH}" placeholder="18" inputmode="numeric" maxlength="2">
        <span>:</span>
        <input id="sch-${d}-to-m" class="time-part" value="${toM}" placeholder="00" inputmode="numeric" maxlength="2">
      </div>`;
  }).join("");

  document.getElementById("modal-specialist").style.display = "flex";
}

async function saveSpecialist() {
  const id = document.getElementById("sp-id").value;
  const schedule = {};
  weekdays.forEach(d => {
    const fromH = normalizeTimePart(document.getElementById(`sch-${d}-from-h`).value, 23);
    const fromM = normalizeTimePart(document.getElementById(`sch-${d}-from-m`).value, 59);
    const toH = normalizeTimePart(document.getElementById(`sch-${d}-to-h`).value, 23);
    const toM = normalizeTimePart(document.getElementById(`sch-${d}-to-m`).value, 59);
    schedule[d] = (fromH && fromM && toH && toM) ? [`${fromH}:${fromM}-${toH}:${toM}`] : [];
  });

  const body = {
    name: document.getElementById("sp-name").value,
    photo: document.getElementById("sp-photo").value,
    description: document.getElementById("sp-desc").value,
    schedule,
  };

  if (id) {
    await api("PUT", `/admin/specialists/${id}`, body);
  } else {
    await api("POST", "/admin/specialists", body);
  }

  closeModal("modal-specialist");
  allSpecialists = await api("GET", "/admin/specialists");
  loadSpecialistsList();
}

function normalizeTimePart(value, max) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";

  const number = Math.min(Number(digits), max);
  return String(number).padStart(2, "0");
}

function updatePhotoPreview(src) {
  const preview = document.getElementById("sp-photo-preview");
  const status = document.getElementById("sp-photo-status");
  if (src) {
    preview.src = resolveAssetUrl(src);
    preview.style.display = "block";
    status.textContent = "Фото прикреплено";
  } else {
    preview.removeAttribute("src");
    preview.style.display = "none";
    status.textContent = "Файл JPG, PNG или WEBP до 3 МБ";
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadSpecialistPhoto(input) {
  const file = input.files?.[0];
  if (!file) return;

  const status = document.getElementById("sp-photo-status");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    status.textContent = "Выберите JPG, PNG или WEBP";
    input.value = "";
    return;
  }
  if (file.size > 3 * 1024 * 1024) {
    status.textContent = "Фото должно быть меньше 3 МБ";
    input.value = "";
    return;
  }

  status.textContent = "Загружаем фото...";
  try {
    const dataUrl = await readFileAsDataUrl(file);
    const result = await api("POST", "/admin/specialists/photo", {
      fileName: file.name,
      dataUrl,
    });
    document.getElementById("sp-photo").value = result.url;
    updatePhotoPreview(result.url);
  } catch (err) {
    status.textContent = "Не удалось загрузить фото";
  }
}

// ── Услуги ─────────────────────────────────────────────────────────

async function loadServicesList() {
  const el = document.getElementById("services-list");
  el.innerHTML = allServices.map(s => `
    <div class="item-card">
      <div class="item-info">
        <div class="item-name">${s.name}</div>
        <div class="item-sub">${s.description || ""}</div>
      </div>
      <div class="item-actions">
        <button class="a-btn small" onclick="openServiceModal(${s.id})">✎</button>
        <button class="a-btn small danger" onclick="deleteService(${s.id})">✕</button>
      </div>
    </div>`
  ).join("");
}

function openServiceModal(id) {
  const s = id ? allServices.find(x => x.id === id) : null;
  document.getElementById("modal-service-title").textContent = s ? "Редактировать услугу" : "Добавить услугу";
  document.getElementById("svc-id").value = s?.id || "";
  document.getElementById("svc-name").value = s?.name || "";
  document.getElementById("svc-desc").value = s?.description || "";
  document.getElementById("modal-service").style.display = "flex";
}

async function saveService() {
  const id = document.getElementById("svc-id").value;
  const body = {
    name: document.getElementById("svc-name").value,
    description: document.getElementById("svc-desc").value,
  };
  if (id) {
    await api("PUT", `/admin/services/${id}`, body);
  } else {
    await api("POST", "/admin/services", body);
  }
  closeModal("modal-service");
  allServices = await api("GET", "/admin/services");
  loadServicesList();
}

async function deleteService(id) {
  if (!confirm("Удалить услугу?")) return;
  await api("DELETE", `/admin/services/${id}`);
  allServices = await api("GET", "/admin/services");
  loadServicesList();
}

// ── Связь специалист ↔ услуга ──────────────────────────────────────

function openSSModal(specId, specName, svcId, svcName, price, duration) {
  document.getElementById("modal-ss-name").textContent = `${specName} — ${svcName}`;
  document.getElementById("ss-specialist-id").value = specId;
  document.getElementById("ss-service-id").value = svcId;
  document.getElementById("ss-price").value = price || "";
  document.getElementById("ss-duration").value = duration || "";
  document.getElementById("modal-ss").style.display = "flex";
}

async function saveSpecialistService() {
  await api("POST", "/admin/specialist-service", {
    specialistId: document.getElementById("ss-specialist-id").value,
    serviceId: document.getElementById("ss-service-id").value,
    price: +document.getElementById("ss-price").value,
    duration_min: +document.getElementById("ss-duration").value,
  });
  closeModal("modal-ss");
  allSpecialists = await api("GET", "/admin/specialists");
  loadSpecialistsList();
}

function scheduleClientsSearch() {
  clearTimeout(clientsSearchTimer);
  clientsSearchTimer = setTimeout(loadClients, 250);
}

function toggleBroadcastPanel(force) {
  const panel = document.getElementById("broadcast-panel");
  const button = document.getElementById("broadcast-toggle-btn");
  if (!panel) return;

  const shouldOpen = typeof force === "boolean" ? force : panel.style.display === "none";
  panel.style.display = shouldOpen ? "block" : "none";
  if (button) button.textContent = shouldOpen ? "Скрыть сообщение" : "Отправить сообщение";
}

async function loadClients() {
  const searchEl = document.getElementById("clients-search");
  const listEl = document.getElementById("clients-list");
  const countEl = document.getElementById("clients-count");
  if (!listEl) return;

  const query = searchEl?.value.trim() || "";
  listEl.innerHTML = `<div class="empty-state compact">Загружаем клиентов...</div>`;

  try {
    const rows = await api("GET", `/admin/clients${query ? `?search=${encodeURIComponent(query)}` : ""}`);
    if (countEl) countEl.textContent = `${rows.length} клиентов`;

    if (!rows.length) {
      listEl.innerHTML = `<div class="empty-state">Клиенты не найдены</div>`;
      return;
    }

    listEl.innerHTML = rows.map(client => {
      const name = client.name || "Без имени";
      const initials = name.trim().charAt(0).toUpperCase() || "?";
      return `
        <div class="client-card">
          <div class="client-avatar">${escapeHtml(initials)}</div>
          <div class="client-info">
            <div class="client-name">${escapeHtml(name)}</div>
            <div class="client-phone">${escapeHtml(client.phone)}</div>
          </div>
        </div>`;
    }).join("");
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state">Не удалось загрузить клиентов</div>`;
  }
}

async function broadcastMessage() {
  const messageEl = document.getElementById("broadcast-message");
  const statusEl = document.getElementById("broadcast-status");
  const message = messageEl.value.trim();

  statusEl.style.display = "none";
  statusEl.className = "form-status";

  if (message.length < 2) {
    statusEl.textContent = "Введите текст сообщения.";
    statusEl.classList.add("error");
    statusEl.style.display = "block";
    return;
  }

  if (!confirm("Отправить это сообщение всем клиентам?")) return;

  statusEl.textContent = "Отправляем сообщение...";
  statusEl.style.display = "block";

  try {
    const result = await api("POST", "/admin/clients/broadcast", { message });
    statusEl.textContent = `Готово: отправлено ${result.sent} из ${result.total}. Ошибок: ${result.failed}.`;
    messageEl.value = "";
  } catch (err) {
    statusEl.textContent = "Не удалось отправить рассылку. Проверьте настройки SMS.";
    statusEl.classList.add("error");
  }
}

// ── Расписание (доступные даты) ────────────────────────────────────

async function loadSchedule() {
  const specId = document.getElementById("schedule-specialist").value;
  if (!specId) {
    document.getElementById("schedule-calendar").innerHTML = "";
    scheduleDateRecords = [];
    return;
  }

  scheduleDateRecords = await api("GET", `/admin/available-dates/${specId}`);
  const today = new Date();
  today.setHours(3,0,0,0);

  // Строим сетку на 30 дней
  let html = `<div class="schedule-grid">`;
  const weekdays = ["Вс","Пн","Вт","Ср","Чт","Пт","Сб"];
    const skip = today.getDay() == 0 ? 6 : today.getDay() - 1;
    for(let j = 0; j < skip; j++) {
        html += `
      <div>
      </div>`;
    }

  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);    
    const dateStr = d.toISOString().slice(0, 10);
    const rec = scheduleDateRecords.find(x => x.date === dateStr);
    const isOn = rec?.isAvailable;
    const cls = isOn ? "sched-day on" : "sched-day off";
    const customTime = rec?.customStart && rec?.customEnd ? `${rec.customStart}-${rec.customEnd}` : "";
    html += `
      <button type="button" class="${cls}" onclick="openScheduleDateModal('${dateStr}', ${specId})">
        <div class="day-name">${weekdays[d.getDay()]}</div>
        <div class="day-date">${d.getDate()}.${String(d.getMonth()+1).padStart(2,"0")}</div>
        ${customTime ? `<div class="day-time">${customTime}</div>` : ""}
      </button>`;
  }

  html += `</div>`;
  document.getElementById("schedule-calendar").innerHTML = html;
}

function openScheduleDateModal(date, specId) {
  const rec = scheduleDateRecords.find(x => x.date === date);
  const defaultInterval = getDefaultScheduleInterval(specId, date);
  const [defaultStart = "", defaultEnd = ""] = defaultInterval ? defaultInterval.split("-") : ["", ""];
  const [startH = "", startM = ""] = (rec?.customStart || defaultStart).split(":");
  const [endH = "", endM = ""] = (rec?.customEnd || defaultEnd).split(":");
  const displayDate = createLocalDate(date).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  document.getElementById("schedule-date-title").textContent = displayDate;
  document.getElementById("schedule-date-value").value = date;
  document.getElementById("schedule-date-specialist").value = specId;
  document.getElementById("schedule-date-active").checked = Boolean(rec?.isAvailable);
  document.getElementById("schedule-date-from-h").value = startH || "";
  document.getElementById("schedule-date-from-m").value = startM || "";
  document.getElementById("schedule-date-to-h").value = endH || "";
  document.getElementById("schedule-date-to-m").value = endM || "";
  document.getElementById("schedule-date-error").style.display = "none";
  updateScheduleDateTimeState();
  document.getElementById("modal-schedule-date").style.display = "flex";
}

function updateScheduleDateTimeState() {
  const isActive = document.getElementById("schedule-date-active").checked;
  ["from-h", "from-m", "to-h", "to-m"].forEach(part => {
    document.getElementById(`schedule-date-${part}`).disabled = !isActive;
  });
}

async function saveScheduleDateSettings() {
  const errEl = document.getElementById("schedule-date-error");
  const specId = document.getElementById("schedule-date-specialist").value;
  const date = document.getElementById("schedule-date-value").value;
  const isAvailable = document.getElementById("schedule-date-active").checked;
  const fromH = normalizeTimePart(document.getElementById("schedule-date-from-h").value, 23);
  const fromM = normalizeTimePart(document.getElementById("schedule-date-from-m").value, 59);
  const toH = normalizeTimePart(document.getElementById("schedule-date-to-h").value, 23);
  const toM = normalizeTimePart(document.getElementById("schedule-date-to-m").value, 59);
  const customStart = fromH && fromM ? `${fromH}:${fromM}` : null;
  const customEnd = toH && toM ? `${toH}:${toM}` : null;

  errEl.style.display = "none";

  if (isAvailable) {
    if (!customStart || !customEnd) {
      errEl.textContent = "Укажите начало и конец рабочего дня.";
      errEl.style.display = "block";
      return;
    }

    if (parseTimeToMinutes(customStart) >= parseTimeToMinutes(customEnd)) {
      errEl.textContent = "Конец рабочего дня должен быть позже начала.";
      errEl.style.display = "block";
      return;
    }
  }

  await api("POST", "/admin/available-dates", {
    specialistId: specId,
    date,
    isAvailable,
    customStart: isAvailable ? customStart : null,
    customEnd: isAvailable ? customEnd : null,
  });
  closeModal("modal-schedule-date");
  loadSchedule();
}

// ── Вспомогательные ────────────────────────────────────────────────

function getDefaultScheduleInterval(specId, dateString) {
  const specialist = allSpecialists.find(s => s.id === Number(specId));
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekdayKey = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][date.getUTCDay()];
  return specialist?.schedule?.[weekdayKey]?.[0] || "";
}

function getWeekdayKeyFromDateString(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][date.getUTCDay()];
}

function createBarbershopDateTime(dateString, time) {
  const [year, month, day] = dateString.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hours - 3, minutes, 0, 0));
}

function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function getFreeMinutesForSlot(specialistId, slotDate, rows) {
  const specialist = allSpecialists.find(s => s.id === Number(specialistId));
  const dateString = getBarbershopDateString(slotDate);
  const slotMinutes = getMinutesInBarbershopTz(slotDate);
  const interval = (specialist?.schedule?.[getWeekdayKeyFromDateString(dateString)] || [])
    .map(value => String(value).split("-"))
    .map(([from, to]) => ({ from: parseTimeToMinutes(from), to: parseTimeToMinutes(to) }))
    .find(value => value.from !== null && value.to !== null && slotMinutes >= value.from && slotMinutes < value.to);

  if (!interval) return 0;

  const nextAppointmentStart = rows
    .filter(row => row.specialistId === Number(specialistId) && new Date(row.datetime_start) > slotDate)
    .map(row => getMinutesInBarbershopTz(row.datetime_start))
    .filter(minutes => minutes >= slotMinutes)
    .sort((a, b) => a - b)[0];

  return Math.max(0, (nextAppointmentStart || interval.to) - slotMinutes);
}

function getBarbershopDateString(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BARBERSHOP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function createLocalDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function shiftDateString(dateString, days) {
  const date = createLocalDate(dateString);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getHourInBarbershopTz(dateValue) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: BARBERSHOP_TIME_ZONE,
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date(dateValue));
  return Number(parts.find(part => part.type === "hour")?.value || 0);
}

function getMinutesInBarbershopTz(dateValue) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: BARBERSHOP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(dateValue));
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return Number(value.hour || 0) * 60 + Number(value.minute || 0);
}

function parseTimeToMinutes(time) {
  const [hours, minutes] = String(time || "").split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function formatTime(date) {
  return date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: BARBERSHOP_TIME_ZONE,
  });
}

function formatDateRu(date) {
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: BARBERSHOP_TIME_ZONE,
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function resolveAssetUrl(url) {
  if (!url) return "";
  if (/^(https?:)?\/\//.test(url) || url.startsWith("data:")) return url;
  if (url.startsWith("/uploads/")) return `${API.replace(/\/api$/, "")}${url}`;
  return url;
}

function closeModal(id) {
  document.getElementById(id).style.display = "none";
}

async function api(method, path, body, useToken = true) {
  const headers = { "Content-Type": "application/json" };
  if (useToken && token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(API + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    if (res.status === 401) doLogout();
    throw new Error(await res.text());
  }
  return res.json();
}

async function unlinkService(specialistId, serviceId) {
  if (!confirm("Удалить связь специалиста с этой услугой?")) return;
  await api("DELETE", "/admin/specialist-service", {
    specialistId,
    serviceId,
  });
  allSpecialists = await api("GET", "/admin/specialists");
  loadSpecialistsList();
}
