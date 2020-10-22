const express = require('express');
const logger = require('morgan');
const path = require('path');
const admin = require("firebase-admin");
const bodyParser = require("body-parser");
const middlew = require("express-firebase-middleware");
const models = require("./models");

//Initializing Firebase-admin SDK
var serviceAccount = require('./sanskrut-interns-firebase-adminsdk.json');
var firebaseAdmin = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://sanskrut-interns.firebaseio.com"
});

// var firebaseAdmin_other = admin.initializeApp({
//     credential: admin.credential.cert(serviceAccount),
//     databaseURL: "https://sanskrut-interns-memory.firebaseio.com/"
// }, "other");

var firedb = firebaseAdmin.database();
// var firedb_m = firebaseAdmin_other.database();

const app = express();
// app.use(express.static(path.join(__dirname, 'views')));
app.use(logger('dev'));
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');


//
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Authorization, Access-Control-Request-Method, Access-Control-Request-Headers');
    res.header('Access-Control-Allow-Methods', 'OPTIONS, GET, POST, PUT, DELETE');
    if ('OPTIONS' === req.method) {
        res.sendStatus(200);
    } else {
        console.log(`${req.ip} ${req.method} ${req.url}`);
        next();
    }
});

app.use(express.json());
// app.use(express.static(path.join(__dirname+'/www')));

// app.get('*', (req, res) => {
//     res.sendFile(path.join(__dirname+'/www/index.html'));

// })


//Adding authorization to particular routes
app.use('/apis/createroom', middlew.auth);
app.use('/apis/joinroom', middlew.auth);
app.use('/apis/setUser', middlew.auth);
app.use('/apis/setState', middlew.auth);
app.use('/apis/setGameStats', middlew.auth);


app.post('/apis/setUser', (req, res) => {
    const uid = req.body.uid;
    const username = req.body.name;
    const emailid = req.body.email;
    // console.log(uid, username);
    let ref = firedb.ref('Users');
    ref.once('value', snapshot => {
        // console.log(snapshot.val())
        let data = snapshot.val();
        if(data==null || !data[uid]){
            ref.child(uid).set({
                name : username,
                email : emailid,
                gameplay : 0,
                wins : 0
            })
            res.send(true)
        } else {
            res.send(false)
        }
    })
})


app.get('/apis/createroom', (req, res) => {

    //Generating a random 7-digit number as game-room token
    var roomToken = models.randRoom()
    //Initializing particular node reference in firebase
    var roomRef = firedb.ref('/rooms');
    //Fetching idToken generated by firebase after login from the authorization header
    var idToken = req.header("Authorization");
    if (idToken == undefined) {
        console.log("no header recieved")
        return null
    }
    idToken = idToken.substr(7, idToken.length);

    //Using firebaseAdmin to verfiy itToken fetched from frontend
    firebaseAdmin.auth().verifyIdToken(idToken).then((decodedToken) => {
        //After verification, decoding the idToken
        let uid = decodedToken.uid;
        firebaseAdmin.auth().getUser(uid)
            .then(function (userRecord) {
                //New player with roomToken set in db with this function
                // models.newRoomCreate(userRecord, roomRef, firedb, roomToken);
                var currentUser = userRecord.displayName;
                var userID = userRecord.uid;
                //Creating a branch in firebase for new rooms
                roomRef.child('room_' + roomToken)
                    .set({ roomid: roomToken, tempCounter: 2, tempState: false, memberChance: 1, dice: 0})
                    .then(function () {
                        console.log("roomToken add to db");
                        res.send({ room_token: roomToken });
                    })
                    .catch(function (err) {
                        console.log(err);
                        res.send(false);
                    });

                var roomRef1 = firedb.ref('/rooms/room_' + roomToken + '/players');
                roomRef1.child('player_1').set({ name: currentUser, position: 0, playerUID: userID})
                    .then(function () {
                        console.log('Player 1 name set')
                    })
                    .catch(function (err) {
                        console.log(err);
                    });
            })
            .catch(function (error) {
                //check for error
                console.log('Error fetching user data:', error);
            });

    }).catch(function (error) {
        console.log(error);
    });

});



app.post('/apis/joinroom', function(req, res){

    var roomToken = req.body.enterid;
    var username = req.body.entername;
    let userID = req.body.uid;
    var flag=0;

    var ref = firedb.ref('/rooms/room_'+roomToken);

    ref.once('value', function(snapshot){

        var count = snapshot.child('tempCounter');
        var countVal = count.val();

        var roomRef = firedb.ref('/rooms/room_'+roomToken+'/players');
        roomRef.once('value', function(data){

            var lenref = Object.keys(data.val()).length;
            

            if(lenref<4){

                for(var i=1; i<=lenref; i++){
                    var checkUID = data.child('player_'+i+'/playerUID').val();
                    console.log(checkUID);
                    if(checkUID==userID){
                        console.log('same match!');
                        flag=1;
                    }
                    if(flag==1){
                        return res.send(true)
                    }
                    
                }

                roomRef.child('player_'+countVal).set({name : username, position: 0, playerUID: userID})
                    .then(function(){
                            countVal = countVal+1;
                            ref.update({tempCounter : countVal});
                            // res.redirect('/createroom/'+roomToken);
                            return res.send(true);
                    })
                    .catch(function(err){
                        console.log(err);
                    });
            } else{
                return res.send(false);
            };

        });
    })


});




app.post('/apis/board/:id', (req, res) => {
    var playerNo = req.body.memberChance;
    var newPos = req.body.position;
    var myDice = req.body.dice;
    var roomToken = req.params.id;
    //id is the roomToken here
    console.log(myDice);
    firedb.ref('rooms/room_'+roomToken).update({dice: myDice});

    firedb.ref('SnL').once('value', snapshot => {
        var snakesLadders = snapshot.val();
        if(newPos in snakesLadders){
            newPos = snakesLadders[newPos];
            console.log("new pos : ",newPos)
        } else{
            console.log('Not found')
        }

        var ref = firedb.ref('/rooms/room_' + roomToken + '/players');
        ref.child('player_' + playerNo).update({ position: newPos});
        ref.once('value', data => {
            var lenref = Object.keys(data.val()).length;
            ref = firedb.ref('/rooms/room_' + roomToken);
            if (playerNo < lenref){
                playerNo++;
            } else {
                playerNo = 1;
            }
            ref.update({memberChance: playerNo});
        })

    }).then(()=>{
        res.send(true)
    }).catch(error=>{
        console.log(error)
    })


});

app.get('/apis/board', (req, res) => {
    var dice = models.diceRoll()
    
    res.send({ dice_value: dice })
})


app.post('/apis/setState', (req, res) => {
    const roomID = req.body.roomid;
    console.log(roomID);
    firedb.ref('rooms/room_'+roomID).update({tempState: true}, (error)=>{
        if(error){
            res.send(error);
        } else {
            res.send('Write successful');
        }
    });
})


app.post('/apis/setGameStats', (req, res) => {
    const playerNo = req.body.playerNo;
    const roomID = req.body.roomid;
    console.log(playerNo, roomID);
    let winSnap;
    let gplaySnap;
    let playersid;
    const ref = firedb.ref('rooms/room_'+roomID+'/players');
    
    ref.once('value', snapshot => {
        if(snapshot!=null || snapshot!=undefined){

            var lenref = Object.keys(snapshot.val()).length;
            // res.send({length:lenref})
            for(var i=1; i<=lenref; i++){          
                
                playersid = snapshot.child('player_'+i+'/playerUID').val();
                if (i==playerNo){
                    let ref1 = firedb.ref('Users/'+playersid);
                    ref1.once('value', snapshot=>{
                        winSnap = snapshot.child('wins').val();
                        winSnap++;
                        ref1.update({wins: winSnap});
                    })   
                }
                const ref2 = firedb.ref('/Users/'+playersid);
                ref2.once('value', snapshot1=>{
                    gplaySnap = snapshot1.child('gameplay').val();
                    gplaySnap++;
                    ref2.update({gameplay: gplaySnap});
                })

                // firedb.ref('rooms/room_'+roomID).remove();
                
            }
        }
        
    }).then(()=>{
        res.send(true)
    }).catch(err=>{
        console.log(err);
    });
})

app.post('/apis/roomDelete', (req, res) => {
    var roomid = req.body.roomNo;
    firedb.ref('rooms/room_'+roomid).remove().then(_ => {
        res.send(true);
    });
})



// Memory game apis :-

app.get('/apis/mmry/createroom', (req, res) => {

    //Generating a random 7-digit number as game-room token
    var roomToken = models.randRoom()
    //Initializing particular node reference in firebase
    var roomRef = firedb.ref('memory/rooms');
    //Fetching idToken generated by firebase after login from the authorization header
    var idToken = req.header("Authorization");
    if (idToken == undefined) {
        console.log("no header recieved")
        return null;
    }
    idToken = idToken.substr(7, idToken.length);

    //Using firebaseAdmin to verfiy itToken fetched from frontend
    firebaseAdmin.auth().verifyIdToken(idToken).then((decodedToken) => {
        //After verification, decoding the idToken
        let uid = decodedToken.uid;
        firebaseAdmin.auth().getUser(uid)
            .then( (userRecord) =>  {
                //New player with roomToken set in db with this function
                // models.newRoomCreate(userRecord, roomRef, firedb_m, roomToken);
                var currentUser = userRecord.displayName;
                var userID = userRecord.uid;
                var photo = userRecord.photoURL;
                //Creating a branch in firebase for new rooms
                roomRef.child('room_' + roomToken)
                    .set({ roomid: roomToken, memberChance: 1, clickValue: 1, tempState: false, clickState: false})
                    .then(() => {
                        console.log("roomToken add to db");
                        res.send({ room_token: roomToken });
                        // res.send({data: "hello!"});
                    })
                    .catch((err) =>  {
                        console.log(err);
                    });

                var roomRef1 = firedb.ref('memory/rooms/room_' + roomToken + '/players');
                roomRef1.child('player_1').set({ name: currentUser, playerUID: userID, counter: 0, picurl: photo})
                
                roomRef1 = firedb.ref('memory/rooms/room_' + roomToken + '/players/player_1');
                roomRef1.child('click1').set({div_id: 0, image_id: 0});
                roomRef1.child('click2').set({div_id: 0, image_id: 0});
                
            })
            .catch( (error) => {
                //check for error
                console.log('Error fetching user data:', error);
            });

    }).catch( (error) => {
        console.log(error);
    });

});



app.post('/apis/mmry/joinroom', (req, res) => {

    var roomToken = req.body.enterid;
    var username = req.body.entername;
    let userID = req.body.uid;
    var photo = req.body.photourl;
    var flag=0;

    var roomRef = firedb.ref('memory/rooms/room_'+roomToken+'/players');
        roomRef.once('value', (data) => {     
            
            var lenref = Object.keys(data.val()).length;

            if(lenref<2){

                var checkUID = data.child('player_1/playerUID').val();
                console.log(checkUID);
                if(checkUID==userID){
                    console.log('same match!');
                    flag=1;
                }
                if(flag==1){
                    return res.send(true)
                }

                roomRef.child('player_2').set({ name: username, playerUID: userID, counter: 0, picurl: photo})
                    .then(() => {
                            return res.send(true);
                    })
                    .catch((err) => {
                        console.log(err);
                    });
                
                var roomRef1 = firedb.ref('memory/rooms/room_'+roomToken+'/players/player_2');
                roomRef1.child('click1').set({div_id: 0, image_id: 0})
                        .then(() => {
                            return res.send(true);
                    })
                    .catch((err) => {
                        console.log(err);
                    });
            
                roomRef1.child('click2').set({div_id: 0, image_id: 0})
                        .then(() => {
                            return res.send(true);
                    })
                    .catch((err) => {
                        console.log(err);
                    });


                
            } else{
                return res.send(false);
            };

        });


});



app.post('/apis/mmry/setGameStats', (req, res) => {
    const playerNo = req.body.playerNo;
    const roomID = req.body.roomid;
    console.log(playerNo, roomID);
    let winSnap;
    let gplaySnap;
    let playersid;
    const ref = firedb.ref('memory/rooms/room_'+roomID+'/players');
    
    ref.once('value', snapshot => {
        if(snapshot!=null || snapshot!=undefined){

            var lenref = Object.keys(snapshot.val()).length;
            // res.send({length:lenref})
            for(var i=1; i<=lenref; i++){          
                
                playersid = snapshot.child('player_'+i+'/playerUID').val();
                if (i==playerNo){
                    let ref1 = firedb.ref('memoryUsers/'+playersid);
                    ref1.once('value', snapshot=>{
                        winSnap = snapshot.child('wins').val();
                        winSnap++;
                        ref1.update({wins: winSnap});
                    })   
                }
                const ref2 = firedb.ref('memory/Users/'+playersid);
                ref2.once('value', snapshot1=>{
                    gplaySnap = snapshot1.child('gameplay').val();
                    gplaySnap++;
                    ref2.update({gameplay: gplaySnap});
                })   
            }
        }
    }).then(()=>{
        res.send(true)
    }).catch(err=>{
        console.log(err);
    });
})



app.post('/apis/mmry/setvalues/:id', (req, res) => {
    var playerNo = req.body.memberChance;
    var roomToken = req.params.id;
    var divid = req.body.divid;
    // var flip = req.body.flipSt;
    var imgid = req.body.imgid;
    var clickNo = req.body.clickNum;

    var ref = firedb.ref('memory/rooms/room_' + roomToken + '/players/player_'+playerNo);
    ref.child('click'+clickNo).update({div_id: divid, image_id: imgid})
        .then(_ =>{
            res.send(true);
        }).catch((err) => {
            console.log(err);
        })
    
    // ref = firedb.ref('memory/rooms/room_' + roomToken + '/players');
    // ref.once('value', data => {

    //     var lenref = Object.keys(data.val()).length;
    //     ref = firedb.ref('memory/rooms/room_' + roomToken);
    //     if (playerNo < lenref){
    //         playerNo++;
    //     } else {
    //         playerNo = 1;
    //     }
    //     ref.update({memberChance: playerNo})
    //         .then(_ =>{
    //             res.send(true);
    //         }).catch((err) => {
    //             console.log(err);
    //         })

    // })


});


app.post('/apis/mmry/setState', (req, res) => {
    const roomID = req.body.roomid;
    console.log(roomID);
    firedb.ref('memory/rooms/room_'+roomID).update({tempState: true}, (error)=>{
        if(error){
            res.send(error);
        } else {
            res.send('Write successful');
        }
    });
})


app.post('/apis/mmry/setUser', (req, res) => {
    const uid = req.body.uid;
    const username = req.body.name;
    const emailid = req.body.email;
    // console.log(uid, username);
    let ref = firedb.ref('memory/Users');
    ref.once('value', snapshot => {
        // console.log(snapshot.val())
        let data = snapshot.val();
        if(data==null || !data[uid]){
            ref.child(uid).set({
                name : username,
                email : emailid,
                gameplay : 0,
                wins : 0
            })
            res.send(true)
        } else {
            res.send(false)
        }
    })
})

app.post('/apis/mmry/updateMem/:id', (req, res) => {
    var chance = req.body.memberChance;
    var room = req.params.id;

    firedb.ref('memory/rooms/room_'+room).update({memberChance: chance}).then(_ =>{
        res.send(true);
    }).catch(err => {
        console.log(err);
    });

})

app.post('/apis/mmry/updateVals/:id', (req, res) => {
    var count = req.body.count;
    count++;
    var room = req.params.id;
    var mem = req.body.memberChance;
    count++;

    firedb.ref('memory/rooms/room_'+room+'/players/player_'+mem).update({counter: count})
                                                                .then(_ => res.send(true))
                                                                .catch(err => console.log(err));
    // firedb.ref('memory/rooms/room_'+room+'/players/player_'+mem+'/click1').update({flipState: false});
    // firedb.ref('memory/rooms/room_'+room+'/players/player_'+mem+'/click2').update({flipState: false})
    //                                                                       .then(_ => res.send(true))
    //                                                                       .catch(err => console.log(err));
      

})


app.post('/apis/cleartemp', (req, res) => {
    firedb.ref('memory/rooms/room_4999559').update({memberChance: 1, clickValue: 1});
    for(var i=1; i<=2;i++){
        firedb.ref('memory/rooms/room_4999559/players/player_'+i).update({counter: 0});
        for(var j=1; j<=2; j++){
            firedb.ref('memory/rooms/room_4999559/players/player_'+i).child('click'+j).update({div_id:-1, image_id: "", flipState: false});
        }
    }
    res.send(true);
})


app.post('/apis/mmry/updateClick/:id', (req, res) =>{
    var click = req.body.clickValue;
    var room = req.params.id;

    firedb.ref('memory/rooms/room_'+room).update({clickValue: click}).then(_ =>{
        res.send(true);
    }).catch(err => {
        console.log(err);
    });
})




module.exports = app;
