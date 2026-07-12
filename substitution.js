const SUPABASE_URL = "https://dbfycihbcosuxxkrmbhl.supabase.co";

const SUPABASE_KEY = "sb_publishable_aOyXtAbzrrX0Z9jPAU1qEA_0ZnK35BX";


const db=supabase.createClient(
SUPABASE_URL,
SUPABASE_KEY
);



let currentPeriods=[];

let teachers=[];



// Load teachers when page opens

window.onload=async()=>{

document.getElementById("subDate").valueAsDate=new Date();

await loadTeachers();

};



async function loadTeachers(){


let {data,error}=await db
.from("tsp_teachers")
.select("*")
.order("teacher_name");


teachers=data;


let sel=document.getElementById("absentTeacher");


data.forEach(t=>{


sel.innerHTML+=
`
<option value="${t.id}">
${t.teacher_name}
</option>
`;

});


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


btn.disabled=true;
btn.innerHTML="Loading...";



let teacher=
document.getElementById("absentTeacher").value;


let date=
document.getElementById("subDate").value;


if(!teacher || !date)
return;



let day=getDayName(date);



let {data,error}=await db
.from("tsp_timetables")
.select(`
*,
tsp_classes(class_name)
`)
.eq("teacher_id",teacher)
.eq("day",day);



currentPeriods=data;


displayPeriods(data,date);

btn.disabled=false;
btn.innerHTML="Load Periods";


}



async function getAvailableTeachers(day,period,date,absent){



// normal timetable teachers

let busy1=await db
.from("tsp_timetables")
.select("teacher_id")
.eq("day",day)
.eq("period_no",period);



// already substitution teachers

let busy2=await db
.from("tsp_substitutions")
.select("assigned_teacher_id")
.eq("substitute_date",date)
.eq("period_no",period);



let busy=[];


if (busy1.data) {

    busy1.data.forEach(x=>{
        busy.push(x.teacher_id);
    });

}


if (busy2.data) {

    busy2.data.forEach(x=>{
        busy.push(x.assigned_teacher_id);
    });

}
busy.push(Number(absent));



return teachers.filter(t=>
!busy.includes(t.id)
);


}




async function displayPeriods(data,date){


let container=
document.getElementById("periodContainer");


container.innerHTML="";


let day=getDayName(date);

let absent=
document.getElementById("absentTeacher").value;



for(let p of data){



let available=
await getAvailableTeachers(
day,
p.period_no,
date,
absent
);



let options=
`
<option value="">
Select Teacher
</option>
`;



available.forEach(t=>{

options+=
`
<option value="${t.id}">
${t.teacher_name}
</option>
`;

});



container.innerHTML+=

`
<div class="periodCard">

<b>Period : ${p.period_no}</b><br>

Class : ${p.tsp_classes.class_name}<br>

Subject : ${p.subject}


<select 
class="assignTeacher"
data-period="${p.period_no}"
data-class="${p.class_id}"
data-subject="${p.subject}">

${options}

</select>


</div>
`;

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



let {error}=await db
.from("tsp_substitutions")
.insert(insertData);



if(error){

alert(error.message);

}
else{

alert("Saved Successfully");

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



data.forEach(x=>{


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