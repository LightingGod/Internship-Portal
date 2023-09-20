const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const { createServer } = require('node:http');
const { Server } = require('socket.io');


const app = express();
const server = createServer(app);

app.set('view engine','ejs');       
app.use(bodyParser.urlencoded({extended:true}));
app.use(express.static('Public'));
app.use(session({
    secret: 'Utkarsh Varshney',
    resave: false,
    saveUninitialized: false  
}));  
app.use(passport.initialize());
app.use(passport.session());
app.use(express.json());

mongoose.connect('mongodb://localhost:27017/NewInternshipPortal');

// Making Schemas and Models
let InternshipSchema = new mongoose.Schema({
    InternshipID: String,
    FacultyID: String,
    FacultyName: String,
    InternshipSubject: String,
    InternshipBrief: String,
    Duration: String,
    Requirement: String
});
const Internship = new mongoose.model('Internship',InternshipSchema);


let UserSchema = new mongoose.Schema({
    Name: String,
    username: String,
    password: String,
    PhoneNumber: Number,
});

UserSchema.plugin(passportLocalMongoose);
const User = new mongoose.model('User',UserSchema);

passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

let StudentSchema =  new mongoose.Schema({
    Address: String,
    Specialist: String,
    Age: Number,
    Gender: String,
    DOB: String,
    Resume: String,
    StudentID: String   //Student ID will be given by the system automatically according to the institute.
});
const Student = User.discriminator('Student',StudentSchema);

let facultySchema =  new mongoose.Schema({
    facultyID: String,
    myInternships: [InternshipSchema],
});
const Faculty = User.discriminator('Faculty',facultySchema);



let QuerySchema = mongoose.Schema({
    StudentUsername: String,
    InternshipStatus: String,
    InternshipID: String,
    StudentDetails1: StudentSchema,
    StudentDetails2: UserSchema,
    InternshipDetails: InternshipSchema
});
const Query = new mongoose.model('Query',QuerySchema);

let MessageSchema = mongoose.Schema({
    user1ID: String,
    user2ID: String,
    SenderID: String,
    body: String
},{timestamps: true});
const Message = new mongoose.model('Message',MessageSchema);




// Socket Io Part
const io = new Server(server);

io.use((socket, next) => {
    const username = socket.handshake.auth.username;
    if (!username) {
      return next(new Error("invalid username"));
    }
    socket.username = username;
    next();
});

io.on('connection', (socket) => {
    console.log('a user connected');
    // console.log(socket.id);

    // const users = [];
    // for (let [id, socket] of io.of("/").sockets) {
    //     users.push({
    //         userID: id,
    //         username: socket.username,
    //     });
    // }

    // console.log(users);

    // socket.emit("users", users);


     // To recieve the message and then send it to particular user if logedIn otherwise save in the database.
    socket.on("private message", async({ content, to }) => {
        const users=[];
        let senderID = null;
        let reciverID = null;


        for (let [id, socket] of io.of("/").sockets) {
            users.push({
                userID: id,
                username: socket.username,
            });
        }

        console.log(users);
        console.log(content);

        users.forEach((user)=>{
            if(user.username===content.user2ID){
                reciverID=user.userID;
            }
            if(user.username===content.user1ID){
                senderID = user.userID
            }
        });

        let messagedata = content.message;

        let tempmessage = new Message({
            user1ID: content.user1ID,
            user2ID: content.user2ID,
            SenderID: content.user1ID,
            body: content.message
        });
        const resp = await tempmessage.save();
        console.log(reciverID);
        if(reciverID!=null){
            socket.to(reciverID).emit("private message", {
                content: messagedata,
                from: content.user1ID,
            });
        }
    });

    socket.on("private message faculty", async({ content, to }) => {
        const users=[];
        let senderID = null;
        let reciverID = null;


        for (let [id, socket] of io.of("/").sockets) {
            users.push({
                userID: id,
                username: socket.username,
            });
        }

        users.forEach((user)=>{
            if(user.username===content.user2ID){
                senderID=user.userID;
            }
            if(user.username===content.user1ID){
                reciverID = user.userID
            }
        });

        let messagedata = content.message;

        let tempmessage = new Message({
            user1ID: content.user1ID,
            user2ID: content.user2ID,
            SenderID: content.user2ID,
            body: content.message
        });
        const resp = await tempmessage.save();
        console.log(reciverID);
        if(reciverID!=null){
            console.log("Hello");
            socket.to(reciverID).emit("private message", {
                content: messagedata,
                from: content.user2ID,
            });
        }
    });


    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});








app.get('/',async (req,res)=>{
    const resp = await Internship.find({});
    res.render('index',{currintern: resp});
});

// For Student
    // Registration
app.get('/studentregister',(req,res)=>{
    res.render('Registration');
});

app.post('/studentregister',(req,res)=>{
    Student.register({Name: req.body.name,username: req.body.username,Address: req.body.address,PhoneNumber: req.body.phone,Specialist: req.body.work,Age: req.body.age,Gender: req.body.gender,DOB: req.body.dob,Resume: req.body.Resume},req.body.password,(err,user)=>{
        if(err){
            console.log(err);
            res.redirect('/studentregister');
        }
        else{
            passport.authenticate("local")(req,res,()=>{
                res.redirect('/studentpage');
            })
        }
    })
});



    // Student Login
app.get('/studentlogin',(req,res)=>{
    res.render('StudentLogin');
});

app.post('/studentlogin',(req,res)=>{
    let tempstudent = new Student({
        username: req.body.username,
        password: req.body.password
    });
    req.login(tempstudent,(err)=>{
        if(err){
            console.log(err);
            res.redirect('/studentlogin');
        }
        else{
            passport.authenticate('local')(req,res,()=>{
                res.redirect('/studentpage');
            })
        }
    });
});

    // Student Dashboard+Profile
app.get('/studentpage',async (req,res)=>{
    if(req.isAuthenticated() && req.user.__t=="Student"){
        const resp = await Query.find({StudentUsername: req.user.username});
        res.render('StudentPage',{thisstudent: req.user,myallInternships: resp});
    }   
    else{
        if(req.isAuthenticated()){
            req.logout((err)=>{
                res.redirect('/studentlogin');
            })
        }
        else{
            res.redirect('/studentlogin');
        }
    }
})

app.get('/studentprofile',(req,res)=>{
    if(req.isAuthenticated() && req.user.__t=="Student"){
        res.render('StudentProfile',{thisstudent: req.user});
    }
    else{
        if(req.isAuthenticated()){
            req.logout((err)=>{
                res.redirect('/studentlogin');
            })
        }
        else{
            res.redirect('/studentlogin');
        }
    }
})

app.post('/changestudent',(req,res)=>{
    const resp = Student.findOneAndUpdate({username: req.body.username},{Address: req.body.Address, PhoneNumber: req.body.Phone,Resume: req.body.Resume});
    res.redirect('/studentprofile');
});

app.get('/internship',async (req,res)=>{
    if(req.isAuthenticated() && req.user.__t=="Student"){
        const resp = await Internship.find({});
        res.render('NewInternship',{thisstudent: req.user, myInternships: resp , myusername: req.user.username})
    }
    else{
        if(req.isAuthenticated()){
            req.logout((err)=>{
                res.redirect('/studentlogin');
            })
        }
        else{
            res.redirect('/studentlogin');
        }
    }
});

app.post('/updateInternship',async (req,res)=>{
    const resp = await Query.findOne({StudentUsername: req.body.username , InternshipID: req.body.InternshipID});
    if(resp!=null){
        console.log("Match Found thus not able to create new Query");
    }
    else{
        const intern1 = await Internship.findOne({InternshipID: req.body.InternshipID});
        const studentdetail = await Student.findOne({username: req.body.username});
        let tempquery = new Query({
            StudentUsername: req.body.username,
            InternshipID: req.body.InternshipID,
            InternshipStatus: "Waiting For Approval",
            StudentDetails1: studentdetail,
            StudentDetails2: studentdetail,
            InternshipDetails: intern1
        });
        const resp = await tempquery.save();
    }

    res.redirect('/studentpage');
});



// For Faculty
    // Registration(Here is done for ease otherwise it will be added by admin directly to the database.)
app.get('/addfaculty',(req,res)=>{
    res.render('AddFaculty');
});

app.post("/makefaculty",(req,res)=>{
    Faculty.register({username: req.body.username ,Name: req.body.FirstName+" "+req.body.LastName ,facultyID: req.body.FacultyID , PhoneNumber:req.body.phone},req.body.password,(err,user)=>{
        if(err){
            console.log(err);
            res.redirect('/addfaculty');
        }
        else{
            passport.authenticate("local")(req,res,()=>{
                res.redirect('/FacultyPage');
            })
        }
    })
});

    // Faculty Login
app.get('/facultylogin',(req,res)=>{
    res.render('facultylogin');
});

app.post('/facultyrequest',(req,res)=>{
    let faculty1 = new Faculty({
        username: req.body.username,
        password: req.body.password
    });
    req.login(faculty1,(err)=>{
        if(err){
            console.log(err);
            res.redirect('/facultylogin');
        }
        else{
            passport.authenticate('local')(req,res,()=>{
                res.redirect('/FacultyPage');
            })
        }
    });
});

    // Faculty Dashboard+More Pages.
app.get('/FacultyPage',(req,res)=>{
    if(req.isAuthenticated() && req.user.__t=="Faculty"){
        res.render('FacultyPage',{thisfaculty: req.user});
        // To see the details for students who applied for my internship I will pass the internship ID in the url as "myinterns/InternshipID".
    }
    else{
        if(req.isAuthenticated()){
            req.logout((err)=>{
                res.redirect('/facultylogin');
            })
        }
        else{
            res.redirect('/facultylogin');
        }
    }
})

app.get('/makeinternship',(req,res)=>{
    if(req.isAuthenticated()){
        res.render('MakeInternship');
    }
    else{
        res.redirect('/facultylogin');
    }
})

app.post('/makeInternship',async (req,res)=>{
    let Internship1 = new Internship({
        InternshipID: req.body.InternshipID,
        FacultyID: req.body.FacultyID,
        FacultyName: req.body.FacultyName,
        InternshipSubject: req.body.Subject,
        InternshipBrief: req.body.Brief,
        Duration: req.body.Duration,
        Requirement: req.body.Requirement
    });
    const resp = await Internship1.save();
    const resp2 = await Faculty.updateOne({facultyID: req.body.FacultyID},{$push: {myInternships: [Internship1]}});     //Used to push the element in array in mongoose.
    res.redirect('/FacultyPage');
});

app.post('/FindInterestedStudents',(req,res)=>{
    res.redirect('/InterestedStudents/'+req.body.InternshipID);
});

app.get('/InterestedStudents/:InternshipID',async (req,res)=>{
    if(req.isAuthenticated()){
        const resp1 = await Internship.findOne({InternshipID: req.params.InternshipID})
        if(resp1.FacultyID==req.user.facultyID){
            const resp2 = await Query.find({InternshipID: req.params.InternshipID})
            res.render("InterestedStudents",{thisInternship: req.params.InternshipID,InterestedStudent: resp2});
        }
        else{
            res.redirect('/facultylogin');
        }
    }
    else{
        res.redirect('/facultylogin');
    }
})

app.post('/changestatustoapprove',async (req,res)=>{           //For Accepting the student
    const resp = await Query.updateOne({StudentUsername: req.body.username , InternshipID: req.body.InternshipID},{InternshipStatus:"Approved"})
    res.redirect('/FacultyPage');
});

app.post('/changestatustoreject',async (req,res)=>{           //For Rejecting the student
    const resp = await Query.updateOne({StudentUsername: req.body.username,InternshipID: req.body.InternshipID},{InternshipStatus:"Rejected"});
    res.redirect('/FacultyPage');
});



// For Logout of Student and Faculty.
app.get("/logout",(req, res)=>{
    req.logout((err)=>{
        if (err){ 
            console.log(err);
        }
        res.redirect('/');
    });
});


// Making Message facility for student.
app.get('/MakeMessage',async (req,res)=>{
    if(req.isAuthenticated() && req.user.__t=="Student"){
        const allfac = await Faculty.find({});
        const data = null;
        res.render('MessagePage',{facultyavailable: allfac, Particulardata:data, selectedfac: data, customuserid: req.user.username});
    }
    else{
        if(req.isAuthenticated()){
            req.logOut(()=>{
                res.redirect('/studentlogin');        
            })
        }
        else{
            res.redirect('/studentlogin');
        }
    }
})

app.get('/MakeMessage/:User2ID',async (req,res)=>{
    if(req.isAuthenticated() && req.user.__t=="Student"){
        const allfac = await Faculty.find({});
        const data = await Message.find({user1ID: req.user.username,user2ID: req.params.User2ID}).sort({ "timestamps" : -1 });
        const fac = await Faculty.find({facultyID: req.params.User2ID});
        const mydata = {
            facultyID: req.params.User2ID,
            Name: fac[0].Name,
            studentID: req.user.username
        }
        res.render('MessagePage',{facultyavailable: allfac, Particulardata:data, selectedfac:mydata, customuserid: req.user.username});
    }
    else{
        if(req.isAuthenticated()){
            req.logOut(()=>{
                res.redirect('/studentlogin');        
            })
        }
        else{
            res.redirect('/studentlogin');
        }
    }
})

// Making message interface for faculty
app.get('/facultymessage',async (req,res)=>{
    if(req.isAuthenticated() && req.user.__t=="Faculty"){
        // Only those student will either they want to enroll in internship made by faculty or those who made query.
        const tempdata = [];
        for(let i=0;i<req.user.myInternships.length;i++){
            const resp1 = await Query.find({InternshipID: req.user.myInternships[i].InternshipID});
            resp1.forEach(element => {
                let flag=0;
                for(let j=0;j<tempdata.length;j++){
                    if(tempdata[j].username==element.StudentUsername){
                        flag=1;
                        break;
                    }
                }

                if(flag==0){
                    tempdata.push({username: element.StudentUsername,Name: element.StudentDetails2.Name});
                }
            });
        }
        const resp2 = await Message.find({user2ID: req.user.facultyID});
        for(let j=0;j<resp2.length;j++){
            const element = resp2[j];
            let flag=0;
            for(let i=0;i<tempdata.length;i++){
                if(tempdata[i].username==element.user1ID){
                    flag=1;
                    break;
                }
            }

            if(flag==0){
                const person = await Student.find({username: element.user1ID})
                tempdata.push({username: element.user1ID, Name: person[0].Name});
            }
        }

        const data = null;
        res.render('FacultyMessage',{studentavailable: tempdata, Particulardata:data,selectedstud: data,customuserid: req.user.facultyID});
    }
    else{
        if(req.isAuthenticated()){
            req.logOut(()=>{
                res.redirect('/facultylogin');        
            })
        }
        else{
            res.redirect('/facultylogin');
        }
    }
})


app.get('/facultymessage/:User1ID',async (req,res)=>{
    if(req.isAuthenticated() && req.user.__t=="Faculty"){
        // Only those student will either they want to enroll in internship made by faculty or those who made query.
        const tempdata = [];
        for(let i=0;i<req.user.myInternships.length;i++){
            const resp1 = await Query.find({InternshipID: req.user.myInternships[i].InternshipID});
            resp1.forEach(element => {
                let flag=0;
                for(let j=0;j<tempdata.length;j++){
                    if(tempdata[j].username==element.StudentUsername){
                        flag=1;
                        break;
                    }
                }

                if(flag==0){
                    tempdata.push({username: element.StudentUsername,Name: element.StudentDetails2.Name});
                }
            });
        }
        const resp2 = await Message.find({user2ID: req.user.facultyID});
        for(let j=0;j<resp2.length;j++){
            const element = resp2[j];
            let flag=0;
            for(let i=0;i<tempdata.length;i++){
                if(tempdata[i].username==element.user1ID){
                    flag=1;
                    break;
                }
            }

            if(flag==0){
                const person = await Student.find({username: element.user1ID})
                tempdata.push({username: element.user1ID,Name: person[0].Name});
            }
        }
        const data = await Message.find({user1ID: req.params.User1ID,user2ID: req.user.facultyID}).sort({ "timestamps" : -1 });
        const stud = await Student.find({username: req.params.User1ID});

        const mydata = {
            facultyID: req.user.facultyID,
            Name: stud[0].Name,
            studentID: req.params.User1ID
        }
        res.render('FacultyMessage',{studentavailable: tempdata, Particulardata: data,selectedstud: mydata, customuserid: req.user.facultyID});
    }
    else{
        if(req.isAuthenticated()){
            req.logOut(()=>{
                res.redirect('/facultylogin');        
            })
        }
        else{
            res.redirect('/facultylogin');
        }
    }
});

server.listen(8080, () => {
    console.log('server running at http://localhost:8080');
  });
