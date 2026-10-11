const SUPABASE_URL = "https://dbfycihbcosuxxkrmbhl.supabase.co";

const SUPABASE_KEY = "sb_publishable_aOyXtAbzrrX0Z9jPAU1qEA_0ZnK35BX";


const db=supabase.createClient(
SUPABASE_URL,
SUPABASE_KEY
);



let currentPeriods=[];

let teachers=[];
const LEAVE_STORAGE_PREFIX = "tsp_leave_v1_";

function getLeaveTeacherIds(date) {
    try {
        const value = JSON.parse(localStorage.getItem(LEAVE_STORAGE_PREFIX + date) || "[]");
        return new Set(Array.isArray(value) ? value.map(String) : []);
    } catch (error) {
        console.warn("Could not read locally saved leave list:", error);
        return new Set();
    }
}



// Load teachers and show only teachers marked on leave for the selected date.
window.onload = async () => {
    const dateInput = document.getElementById("subDate");
    const params = new URLSearchParams(window.location.search);
    const passedDate = params.get("date");
    dateInput.value = passedDate || new Date().toLocaleDateString("en-CA");
    dateInput.addEventListener("change", () => {
        document.getElementById("periodContainer").innerHTML = "";
        currentPeriods = [];
        updateLeaveInfo();
    });
    await loadTeachers();
    // Reports reflect the date selected on this screen.
    await loadTodayReport();
    await loadCountReport();
};

async function loadTeachers() {
    const { data, error } = await db
        .from("tsp_teachers")
        .select("*")
        .order("teacher_name", { ascending: true });

    if (error) {
        alert("Could not load teachers: " + error.message);
        return;
    }

    teachers = data || [];
    updateLeaveInfo();
}

function updateLeaveInfo() {
    const date = document.getElementById("subDate")?.value;
    const info = document.getElementById("leaveInfo");
    const sel = document.getElementById("absentTeacher");
    const loadBtn = document.getElementById("loadBtn");
    if (!date || !sel) return;

    const leaveIds = getLeaveTeacherIds(date);
    const leaveTeachers = teachers.filter(t => leaveIds.has(String(t.id)));
    const previousValue = sel.value;
    sel.replaceChildren();

    const firstOption = document.createElement("option");
    firstOption.value = "";
    firstOption.textContent = leaveTeachers.length
        ? "Select Absent Teacher"
        : "No teachers marked on leave";
    sel.appendChild(firstOption);

    leaveTeachers.forEach(t => {
        const option = document.createElement("option");
        option.value = String(t.id);
        option.textContent = t.teacher_name;
        sel.appendChild(option);
    });

    // Preserve the selected teacher only if still on leave for this date.
    if (leaveTeachers.some(t => String(t.id) === previousValue)) sel.value = previousValue;
    if (loadBtn) loadBtn.disabled = leaveTeachers.length === 0;

    if (info) {
        info.textContent = leaveTeachers.length
            ? `Absent-teacher list (${leaveTeachers.length} on leave): ${leaveTeachers.map(t => t.teacher_name).join(", ")}. All these teachers are excluded from substitute choices.`
            : "No teachers are marked on leave for this date in this browser. Record leave in the Leave Entry page first.";
    }
}

// Date to Day

function getDayName(date){


let d=new Date(date);


return d.toLocaleDateString(
'en-US',
{weekday:'long'}
).toUpperCase();


}




async function loadPeriods(){


let btn=document.getElementById("loadBtn");


if(btn.disabled){
    return;
}


const teacher = document.getElementById("absentTeacher").value;
const date = document.getElementById("subDate").value;
if (!teacher || !date) {
    alert("Please select a date and a teacher marked on leave.");
    return;
}
if (!getLeaveTeacherIds(date).has(String(teacher))) {
    alert("The selected absent teacher is not marked on leave for this date. Refresh the leave list first.");
    updateLeaveInfo();
    return;
}

btn.disabled = true;
btn.innerHTML = "Loading...";
try {
    const day = getDayName(date);
    const { data, error } = await db
        .from("tsp_timetables")
        .select(`*, tsp_classes(class_name)`)
        .eq("teacher_id", teacher)
        .eq("day", day);

    if (error) throw error;
    currentPeriods = data || [];
    await displayPeriods(currentPeriods, date);
} catch (error) {
    alert("Could not load periods: " + error.message);
} finally {
    btn.disabled = false;
    btn.innerHTML = "Load Periods";
}


}



// Cached timetable and saved substitutions for the selected day.
let dayTimetableRows = [];
let savedSubstitutionRows = [];
let schoolPeriods = [];

function uniqueNumbers(values) {
    return [...new Set(values.map(Number).filter(Number.isFinite))].sort((a, b) => a - b);
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
}

function getPendingAssignments() {
    const result = [];
    document.querySelectorAll(".assignTeacher").forEach(select => {
        if (select.value) {
            result.push({
                period_no: Number(select.dataset.period),
                assigned_teacher_id: Number(select.value)
            });
        }
    });
    return result;
}

function getOccupiedPeriodsForTeacher(teacherId, pending = getPendingAssignments()) {
    const occupied = new Set();

    dayTimetableRows.forEach(row => {
        if (String(row.teacher_id) === String(teacherId)) {
            occupied.add(Number(row.period_no));
        }
    });

    savedSubstitutionRows.forEach(row => {
        if (String(row.assigned_teacher_id) === String(teacherId)) {
            occupied.add(Number(row.period_no));
        }
    });

    pending.forEach(row => {
        if (String(row.assigned_teacher_id) === String(teacherId)) {
            occupied.add(Number(row.period_no));
        }
    });

    return occupied;
}

function getFreePeriodCount(teacherId, pending = getPendingAssignments()) {
    const occupied = getOccupiedPeriodsForTeacher(teacherId, pending);
    return schoolPeriods.filter(period => !occupied.has(Number(period))).length;
}

function isTeacherBusyInPeriod(teacherId, period, absentId, pending = getPendingAssignments()) {
    if (String(teacherId) === String(absentId)) return true;

    // Any regular timetable lesson in this period makes the teacher unavailable.
    if (dayTimetableRows.some(row =>
        String(row.teacher_id) === String(teacherId) &&
        Number(row.period_no) === Number(period)
    )) return true;

    // Existing saved substitution assignments for this date and period.
    if (savedSubstitutionRows.some(row =>
        String(row.assigned_teacher_id) === String(teacherId) &&
        Number(row.period_no) === Number(period)
    )) return true;

    // A selection already made on this screen blocks the same teacher/period.
    if (pending.some(row =>
        String(row.assigned_teacher_id) === String(teacherId) &&
        Number(row.period_no) === Number(period)
    )) return true;

    return false;
}

async function loadAvailabilityData(day, date) {
    const [timetableResult, substitutionResult] = await Promise.all([
        db.from("tsp_timetables")
            .select("teacher_id, period_no, academic_year_id")
            .eq("day", day)
            .eq("academic_year_id", 1),
        db.from("tsp_substitutions")
            .select("assigned_teacher_id, period_no, academic_year_id")
            .eq("substitute_date", date)
            .eq("academic_year_id", 1)
    ]);

    if (timetableResult.error) throw timetableResult.error;
    if (substitutionResult.error) throw substitutionResult.error;

    dayTimetableRows = timetableResult.data || [];
    savedSubstitutionRows = substitutionResult.data || [];
    schoolPeriods = uniqueNumbers(dayTimetableRows.map(row => row.period_no));
}

function buildPeriodCards(data, date) {
    const container = document.getElementById("periodContainer");
    const absent = document.getElementById("absentTeacher").value;
    const leaveIds = getLeaveTeacherIds(date);
    const pending = getPendingAssignments();

    container.innerHTML = data.map(p => {
        const available = teachers.filter(t =>
            !leaveIds.has(String(t.id)) &&
            !isTeacherBusyInPeriod(t.id, p.period_no, absent, pending)
        ).sort((a, b) => a.teacher_name.localeCompare(b.teacher_name));

        const options = [
            '<option value="">Select Teacher</option>',
            ...available.map(t =>
                `<option value="${escapeHtml(t.id)}">${escapeHtml(t.teacher_name)} (F ${getFreePeriodCount(t.id, pending)})</option>`
            )
        ].join("");

        const className = p.tsp_classes?.class_name || "Class";
        return `
            <div class="periodCard">
                <b>Period : ${escapeHtml(p.period_no)}</b><br>
                Class : ${escapeHtml(className)}<br>
                Subject : ${escapeHtml(p.subject)}
                <select
                    class="assignTeacher"
                    data-period="${escapeHtml(p.period_no)}"
                    data-class="${escapeHtml(p.class_id)}"
                    data-subject="${escapeHtml(p.subject)}">
                    ${options}
                </select>
            </div>`;
    }).join("");

    // Keep the selected value in place; refresh only option lists and F counts.
    // Rebuilding the cards here would temporarily treat the just-selected teacher
    // as busy and could remove their own selection before it is restored.
    container.querySelectorAll(".assignTeacher").forEach(select => {
        select.addEventListener("change", () => {
            refreshPeriodOptions(data, date);
        });
    });
}

function refreshPeriodOptions(data, date) {
    const container = document.getElementById("periodContainer");
    const selectedValues = new Map();
    container.querySelectorAll(".assignTeacher").forEach(select => {
        if (select.value) selectedValues.set(String(select.dataset.period), select.value);
    });

    const absent = document.getElementById("absentTeacher").value;
    const leaveIds = getLeaveTeacherIds(date);
    const pending = getPendingAssignments();

    container.querySelectorAll(".assignTeacher").forEach(select => {
        const period = Number(select.dataset.period);
        const currentValue = selectedValues.get(String(period)) || "";
        const available = teachers.filter(t =>
            !leaveIds.has(String(t.id)) &&
            (String(t.id) === String(currentValue) ||
             !isTeacherBusyInPeriod(t.id, period, absent, pending))
        ).sort((a, b) => a.teacher_name.localeCompare(b.teacher_name));

        select.innerHTML = [
            '<option value="">Select Teacher</option>',
            ...available.map(t =>
                `<option value="${escapeHtml(t.id)}">${escapeHtml(t.teacher_name)} (F ${getFreePeriodCount(t.id, pending)})</option>`
            )
        ].join("");

        if (currentValue && [...select.options].some(option => option.value === currentValue)) {
            select.value = currentValue;
        }
    });
}

async function displayPeriods(data, date) {
    const container = document.getElementById("periodContainer");
    container.innerHTML = "";

    try {
        await loadAvailabilityData(getDayName(date), date);
        buildPeriodCards(data, date);
    } catch (error) {
        alert("Could not calculate teacher availability: " + error.message);
    }
}

async function saveSubstitution(){

let saveBtn=document.getElementById("saveBtn");


if(saveBtn.disabled){

    return;

}


saveBtn.disabled=true;

saveBtn.innerHTML="Saving...";

let date=
document.getElementById("subDate").value;


let absent=
document.getElementById("absentTeacher").value;



let rows=
document.querySelectorAll(".assignTeacher");



let insertData=[];


rows.forEach(r=>{


if(r.value){

insertData.push({

substitute_date:date,

day:getDayName(date),

period_no:Number(r.dataset.period),

class_id:Number(r.dataset.class),

subject:r.dataset.subject,

absent_teacher_id:Number(absent),

assigned_teacher_id:Number(r.value),

academic_year_id:1


});


}


});



if (!date || !absent) {
    alert("Please select the date and absent teacher.");
    saveBtn.disabled = false;
    saveBtn.innerHTML = "SAVE SUBSTITUTION";
    return;
}
if (insertData.length === 0) {
    alert("Please select at least one substitute teacher before saving.");
    saveBtn.disabled = false;
    saveBtn.innerHTML = "SAVE SUBSTITUTION";
    return;
}
const leaveIds = getLeaveTeacherIds(date);
if (!leaveIds.has(String(absent))) {
    alert("The selected absent teacher is not marked on leave for this date. Please return to Leave Entry and save the leave list.");
    saveBtn.disabled = false;
    saveBtn.innerHTML = "SAVE SUBSTITUTION";
    return;
}
const invalidLeaveAssignments = insertData.filter(row => leaveIds.has(String(row.assigned_teacher_id)));
if (invalidLeaveAssignments.length) {
    alert("One or more selected substitute teachers are marked on leave. Reload periods and choose eligible teachers.");
    saveBtn.disabled = false;
    saveBtn.innerHTML = "SAVE SUBSTITUTION";
    return;
}

// Prevent the same substitute from being assigned to multiple classes in one period.
const assignmentKeys = insertData.map(row => `${row.period_no}:${row.assigned_teacher_id}`);
if (new Set(assignmentKeys).size !== assignmentKeys.length) {
    alert("A teacher cannot cover more than one class in the same period.");
    saveBtn.disabled = false;
    saveBtn.innerHTML = "SAVE SUBSTITUTION";
    return;
}

// Recheck current saved assignments to avoid conflicts with another substitution session.
const { data: currentAssignments, error: currentAssignmentsError } = await db
    .from("tsp_substitutions")
    .select("assigned_teacher_id, period_no")
    .eq("substitute_date", date)
    .eq("academic_year_id", 1);
if (currentAssignmentsError) {
    alert("Could not validate existing substitutions: " + currentAssignmentsError.message);
    saveBtn.disabled = false;
    saveBtn.innerHTML = "SAVE SUBSTITUTION";
    return;
}
const conflict = insertData.find(row => (currentAssignments || []).some(existing =>
    Number(existing.period_no) === Number(row.period_no) &&
    String(existing.assigned_teacher_id) === String(row.assigned_teacher_id)
));
if (conflict) {
    alert("A selected teacher has already been assigned in one of these periods. Reload periods and choose another teacher.");
    saveBtn.disabled = false;
    saveBtn.innerHTML = "SAVE SUBSTITUTION";
    return;
}

let {error}=await db
.from("tsp_substitutions")
.insert(insertData);



if(error){

alert(error.message);

}
else{

alert("Saved Successfully");

document.getElementById("periodContainer").innerHTML = "";
currentPeriods = [];
await loadTodayReport();
await loadCountReport();

}

saveBtn.disabled=false;

saveBtn.innerHTML="SAVE SUBSTITUTION";

}




async function loadTodayReport(){


let date=
document.getElementById("subDate").value;


let {data}=await db
.from("tsp_substitutions")
.select(`
*,
tsp_classes(class_name),
absent_teacher:tsp_teachers!absent_teacher_id(teacher_name),
assigned_teacher:tsp_teachers!assigned_teacher_id(teacher_name)
`)
.eq("substitute_date",date);



let html=
"<table><tr><th>Pno</th><th>Class</th><th>Assigned To</th><th>Leave</th></tr>";



(data || []).forEach(x=>{


html+=
`
<tr>

<td>${x.period_no}</td>

<td>${x.tsp_classes.class_name}</td>
<td>${x.assigned_teacher.teacher_name}</td>
<td>${x.absent_teacher.teacher_name}</td>

</tr>
`;

});


html+="</table>";


document.getElementById("todayReport").innerHTML=html;


}


async function downloadPDF(){


let date =
document.getElementById("subDate").value;


if(!date){

alert("Select Date");
return;

}



// Get substitution data

let {data,error}=await db

.from("tsp_substitutions")

.select(`

period_no,

tsp_classes(class_name),
assigned_teacher:tsp_teachers!assigned_teacher_id(teacher_name),

absent_teacher:tsp_teachers!absent_teacher_id(teacher_name),
subject



`)

.eq("substitute_date",date)

.order("period_no");



if(error){

alert(error.message);
return;

}




const { jsPDF } = window.jspdf;


let doc=new jsPDF();


// Title

doc.setFontSize(16);

doc.text(
"Teacher Substitution For:",
14,
15
);


doc.setFontSize(12);

doc.text(
"Date : "+date,
14,
25
);



// Table data

let tableData=[];


data.forEach(x=>{


tableData.push([

x.period_no,

x.tsp_classes.class_name,

x.assigned_teacher.teacher_name,

x.absent_teacher.teacher_name,
x.subject



]);


});



// Create table

doc.autoTable({

startY:35,

head:[

[
"Period",
"Class",
"Assigned To",
"Leave",
"Subject"

]

],

body:tableData

});




// Save

doc.save(
"TSP_Substitution_"+date+".pdf"
);



}


async function loadCountReport(){


let {data}=await db
.rpc("tsp_teacher_assignment_count");



let html = `
<table>
<tr>
<th>Teacher Name</th>
<th>Total Periods</th>
</tr>
`;


data.forEach(x=>{

html +=
`
<tr>
<td>${x.teacher_name}</td>
<td>${x.total_count}</td>
</tr>
`;

});


html += "</table>";


document.getElementById("countReport").innerHTML = html;

}