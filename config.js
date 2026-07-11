// ===============================
// SUPABASE CONNECTION
// ===============================

const SUPABASE_URL = "https://dbfycihbcosuxxkrmbhl.supabase.co";

const SUPABASE_KEY = "sb_publishable_aOyXtAbzrrX0Z9jPAU1qEA_0ZnK35BX";


const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);



// ===============================
// IMPORT EXCEL
// ===============================

async function importExcel(){


let status=document.getElementById("status");

status.innerHTML="Reading Excel...";


let file=document.getElementById("excelFile").files[0];


if(!file){

    alert("Select Excel file");
    return;

}



let academic_year_id=
document.getElementById("academicYear").value;



let buffer=await file.arrayBuffer();


let workbook=XLSX.read(buffer);


let sheet=
workbook.Sheets[workbook.SheetNames[0]];


let rows=
XLSX.utils.sheet_to_json(sheet);



console.log(rows);



status.innerHTML=
"Rows Found : "+rows.length;



// ===============================
// TEACHERS INSERT
// ===============================


let teacherNames=[

];


rows.forEach(r=>{

    if(!teacherNames.includes(r["Teacher Name"]))
    {
        teacherNames.push(
            r["Teacher Name"]
        );
    }

});



let teacherMap={};



for(let name of teacherNames){


let {data,error}=await supabaseClient
.from("tsp_teachers")
.insert({

    teacher_name:name,
    academic_year_id:academic_year_id

})
.select()
.single();



if(error){

console.log(error);

}
else{

teacherMap[name]=data.id;

}


}



// ===============================
// CLASSES INSERT
// ===============================


let classNames=[];


rows.forEach(r=>{


if(!classNames.includes(r["Class"]))
{

classNames.push(r["Class"]);

}


});



let classMap={};



for(let cname of classNames){


let {data,error}=await supabaseClient
.from("tsp_classes")
.insert({

class_name:cname,
academic_year_id:academic_year_id

})
.select()
.single();



if(error){

console.log(error);

}
else{

classMap[cname]=data.id;

}



}



// ===============================
// TIMETABLE INSERT
// ===============================


let timetableData=[];


rows.forEach(r=>{


timetableData.push({

teacher_id:
teacherMap[r["Teacher Name"]],

class_id:
classMap[r["Class"]],

subject:
r["Subject"],

day:
r["Day"],

period_no:
Number(r["Period"]),

academic_year_id:
academic_year_id


});


});



let {error}=await supabaseClient
.from("tsp_timetables")
.insert(timetableData);



if(error){

status.innerHTML=
"Timetable Error : "+error.message;

}
else{


status.innerHTML=
`
Import Completed<br><br>

Teachers : ${teacherNames.length}<br>
Classes : ${classNames.length}<br>
Timetable Rows : ${timetableData.length}

`;

}



}