// TSP Leave Entry page. Leave selections are stored in this browser only.
const SUPABASE_URL = "https://dbfycihbcosuxxkrmbhl.supabase.co";
const SUPABASE_KEY = "sb_publishable_aOyXtAbzrrX0Z9jPAU1qEA_0ZnK35BX";
const leaveDb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const LEAVE_STORAGE_PREFIX = "tsp_leave_v1_";
// If your existing substitution page has a different filename, change this value.
const SUBSTITUTION_PAGE = "substitution.html";

const dateInput = document.getElementById("leaveDate");
const teacherList = document.getElementById("teacherList");
const selectedCount = document.getElementById("selectedCount");
const statusEl = document.getElementById("status");
const gotoBtn = document.getElementById("gotoBtn");
let teachers = [];

function todayLocalISO() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}
function storageKey(date) { return LEAVE_STORAGE_PREFIX + date; }
function readLeaveIds(date) {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey(date)) || "[]");
    return Array.isArray(value) ? value.map(String) : [];
  } catch (e) { return []; }
}
function writeLeaveIds(date, ids) {
  localStorage.setItem(storageKey(date), JSON.stringify([...new Set(ids.map(String))]));
}
function updateCount() {
  selectedCount.textContent = `${teacherList.querySelectorAll('input[type="checkbox"]:checked').length} selected`;
}
function renderTeachers() {
  teacherList.replaceChildren();
  if (!teachers.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No teachers found in tsp_teachers.";
    teacherList.appendChild(empty);
    updateCount();
    return;
  }
  const selectedIds = new Set(readLeaveIds(dateInput.value));
  teachers.forEach((teacher) => {
    const row = document.createElement("label");
    row.className = "teacher-row";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = String(teacher.id);
    checkbox.checked = selectedIds.has(String(teacher.id));
    checkbox.addEventListener("change", updateCount);
    const name = document.createElement("span");
    name.className = "teacher-name";
    name.textContent = teacher.teacher_name || "Unnamed teacher";
    row.append(checkbox, name);
    teacherList.appendChild(row);
  });
  updateCount();
}
async function loadTeachers() {
  teacherList.innerHTML = '<div class="empty">Loading teachers…</div>';
  gotoBtn.disabled = true;
  const { data, error } = await leaveDb
    .from("tsp_teachers")
    .select("id, teacher_name")
    .order("teacher_name", { ascending: true });
  if (error) {
    teacherList.innerHTML = '<div class="empty">Could not load teachers. Check your connection and database permissions.</div>';
    statusEl.textContent = error.message;
    return;
  }
  teachers = data || [];
  renderTeachers();
  gotoBtn.disabled = false;
  statusEl.textContent = "Leave selections are stored locally for each date.";
}
dateInput.addEventListener("change", () => {
  if (!dateInput.value) return;
  renderTeachers();
  statusEl.textContent = "Showing saved leave selections for " + dateInput.value + ".";
});
gotoBtn.addEventListener("click", () => {
  const date = dateInput.value;
  if (!date) {
    alert("Please select a leave date.");
    dateInput.focus();
    return;
  }
  const selectedIds = [...teacherList.querySelectorAll('input[type="checkbox"]:checked')].map(input => input.value);
  try {
    writeLeaveIds(date, selectedIds);
  } catch (error) {
    alert("Could not save the leave list in this browser. Check browser storage settings.");
    return;
  }
  statusEl.textContent = `${selectedIds.length} teacher(s) on leave saved for ${date}. Opening substitution…`;
  window.location.href = SUBSTITUTION_PAGE + "?date=" + encodeURIComponent(date);
});

dateInput.value = todayLocalISO();
loadTeachers();
