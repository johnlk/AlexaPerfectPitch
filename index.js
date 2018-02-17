'use strict';

const Alexa = require('alexa-sdk');
var Speech = require('ssml-builder');

const GAME_STATES = {
    GAME: '_GAMEMODE', // Quizzing on note names
    LEARN: '_LEARNMODE', // Quizzing on note names
    START: '_STARTMODE', // Entry point, start the game.
    SELECT: '_SELECTION', // For selecting game type
    HELP: '_HELPMODE'
};

const APP_ID = 'amzn1.ask.skill.e1753e4d-c3e0-449e-9a83-e399db81f64b';

var clips = require('./clips').clips;

var score = 0;
var clipIndex;
var gameLength = 5;
var clipsPlayed = 0;
var clipsAlreadyPlayed = [];
var inGame = false;

function alreadyPlayed(){
    for(var i = 0; i < clipsAlreadyPlayed.length; i++){
        if(clipIndex == clipsAlreadyPlayed[i]){
            return true;
        }
    }
    return false;
}

function getNHarmoic(){ //n harmonic means 2 names, same note C# == Db for instance
    var answer = getAnswer();
    if(answer.length == 1){
        return '';
    }
    switch(answer[0]){
        case 'C': return 'D flat';
        case 'D': return 'E flat';
        case 'F': return 'G flat';
        case 'G': return 'A flat';
        case 'A': return 'B flat';
    }
    return '';
}

function getAnswer(){
    var name = clips[clipIndex];
    if(name[1] != '%'){
        return name[0]; //C or D
    }else{
        return name[0] + ' sharp';
    }
}

function isCorrect(userAnswer){
    var correctAnswer = getAnswer();
    var nHarmonic = getNHarmoic();
    if(userAnswer.indexOf('.') != -1){
        userAnswer = userAnswer.substring(0, userAnswer.indexOf('.')) + 
                     userAnswer.substring(userAnswer.indexOf('.') + 1, userAnswer.length); //remove periods
    }
    return userAnswer.toLowerCase() == correctAnswer.toLowerCase() || 
           userAnswer.toLowerCase() == nHarmonic.toLowerCase();
}

function handleUserGuess(userDoesntKnow){
    var speech = new Speech();
    var repeat = new Speech();
    var response = "";
    var firstLetter = getAnswer()[0];
    var nHarmonic = getNHarmoic();

    //user doesn't know
    if(userDoesntKnow){
        //emit the answer
        response = 'The note was';
        if(firstLetter == 'A' || firstLetter == 'E' || firstLetter == 'F'){
            response += ' an ';
        }else{
            response += ' a ';
        }
        response += getAnswer();
        if(nHarmonic != ''){
            response += ' or ' + nHarmonic + '. ';
        }

        if(clipsPlayed < gameLength){
            speech.say(response)
              .pause('1s')
              .say("Maybe you will know this one.");
        }

    }else{ //user answered, so check it

        var userAnswer = this.event.request.intent.slots.Answer.value;

        if(isCorrect(userAnswer)){
            response = "You're right!";
            score++;
        }else{
            response = 'Sorry. It was actually';
            if(firstLetter == 'A' || firstLetter == 'E' || firstLetter == 'F'){
                response += ' an ';
            }else{
                response += ' a ';
            }
            response += getAnswer(); 
            if(nHarmonic != ''){
                response += ' or ' + nHarmonic + '. ';
            }
        }

        console.log('User Answer: ' + userAnswer);
        console.log('Correct Answer: ' + getAnswer());

        speech.say(response)
              .pause('1s');
    }
    
    if(clipsPlayed < gameLength){

        speech.say("Here's another")
              .pause('1s');

        do{
            clipIndex = Math.floor(Math.random() * clips.length);
        }while(alreadyPlayed());

        clipsPlayed++;
        clipsAlreadyPlayed.push(clipIndex);

        speech.audio('https://s3.amazonaws.com/pianonotes/' + clips[clipIndex])
              .say('What note was that?');

        //repeat speech
        repeat.say("Here is the note again.")
              .audio('https://s3.amazonaws.com/pianonotes/' + clips[clipIndex]);

        console.log('Audio clip: https://s3.amazonaws.com/pianonotes/' + clips[clipIndex]);

    }else{

        speech.say("You reach the end recieving a score of " + score + " out of " + gameLength)
              .pause('1s')
              .say("Whould you like to play again?");

        repeat.say("Would you like to play again?");
        
    }

    Object.assign(this.attributes, {
        'speechOutput': speech.ssml(true),
        'repromptText': repeat.ssml(true)
    });

    this.handler.state = GAME_STATES.GAME;
    this.emit(':ask', this.attributes['speechOutput'], this.attributes['repromptText']);

}

const newSessionHandlers = {
    'LaunchRequest': function () {
        this.handler.state = GAME_STATES.SELECT;
        this.emitWithState('StartSkill');
    },
    'AMAZON.StartOverIntent': function () {
        this.handler.state = GAME_STATES.SELECT;
        this.emitWithState('StartSkill');
    },
    'AMAZON.HelpIntent': function () {
        this.handler.state = GAME_STATES.HELP;
        this.emitWithState('helpUser', false);
    },
    'Unhandled': function () {
        console.log('unhandled event');
    },
};

const gameSelectionHandlers = Alexa.CreateStateHandler(GAME_STATES.SELECT, {
    'StartSkill': function(){
        this.emit(':ask', 'Hello. I have two modes of play, a game mode and a learning mode. ' + 
            'Which would you like to do? Simply say either Learn or Game.', 'Just say Learn or Game.');
    },
    'SelectModeIntent': function(){
        var selection = this.event.request.intent.slots.Mode.value;
        console.log(selection);
        if(selection == 'learn'){
            this.handler.state = GAME_STATES.LEARN;
            this.emitWithState('StartLearning', false);
        }else{ //playing the game
            this.handler.state = GAME_STATES.GAME;
            this.emitWithState('PlayGame', false);
        }
    },
    'AMAZON.HelpIntent': function () {
        this.handler.state = GAME_STATES.HELP;
        this.emitWithState('helpUser');
    },
    'AMAZON.StopIntent': function(){
        this.emit(':tell', 'See you later.');
    },
    'Unhandled': function () {
        this.emit(':ask', 'Just say Learn or Game.', 'Just say Learn or Game.');
        console.log('unhandled from select state');
    }
});

const gameStateHandlers = Alexa.CreateStateHandler(GAME_STATES.GAME, {
    'PlayGame': function (newGame) {

        clipsPlayed = 0;
        score = 0;
        inGame = true;

        do{
            clipIndex = Math.floor(Math.random() * clips.length);
        }while(alreadyPlayed());

        var speech = new Speech();
        if(!newGame){
            speech.say("Alright I am going to play you " + gameLength + " notes on the piano.")
              .say('You just have to guess the note that was played.')
              .say("Let's see how you do.")
              .audio('https://s3.amazonaws.com/pianonotes/' + clips[clipIndex])
              .say('What note was that?');
        }else{
            speech.say("Let's keep going")
                  .pause('1s')
                  .audio('https://s3.amazonaws.com/pianonotes/' + clips[clipIndex])
                  .say('What note was that?');
        }
        
        var repeat = new Speech();
        repeat.say("Here is the note again.")
              .audio('https://s3.amazonaws.com/pianonotes/' + clips[clipIndex]);

        console.log('Audio clip: https://s3.amazonaws.com/pianonotes/' + clips[clipIndex]);

        Object.assign(this.attributes, {
            'speechOutput': speech.ssml(true),
            'repromptText': repeat.ssml(true)
        });

        clipsPlayed++;
        clipsAlreadyPlayed.push(clipIndex);

        this.handler.state = GAME_STATES.GAME;
        this.emit(':ask', this.attributes['speechOutput'], this.attributes['repromptText']);

    },
    'AnswerIntent': function () {
        handleUserGuess.call(this, false);
    },
    'DontKnowIntent': function () {
        handleUserGuess.call(this, true);
    },
    'AMAZON.RepeatIntent': function () {
        this.emit(':ask', this.attributes['repromptText'], this.attributes['repromptText']);
    },
    'AMAZON.YesIntent': function(){
        console.log('they kept going');
        this.emitWithState('PlayGame', true);
    },
    'AMAZON.NoIntent': function () {
        console.log('game stopped');
        this.emit(':tell', 'See you later.');
    },
    'AMAZON.HelpIntent': function () {
        this.handler.state = GAME_STATES.HELP;
        this.emitWithState('helpUser');
    },
    'AMAZON.StopIntent': function () {
        console.log('game stopped');
        this.emit(':tell', 'See you later.');
    },
    'Unhandled': function () {
        console.log('unhandled from game state');
        this.emit(':tell', 'See you later.');
    },
    'SessionEndedRequest': function () {
        console.log(`Session ended in game state: ${this.event.request.reason}`);
    },
});

const learnStateHanders = Alexa.CreateStateHandler(GAME_STATES.LEARN, {
    'StartLearning': function(newGame){
        var speech = new Speech();

        if(!newGame){
            speech.say("Okay. I am going to play you some natural notes.") 
              .pause('1s')
              .say("No sharps or flats, just notes A, through G.")
              .pause('1s')
              .say("Here comes your first one.")
              .pause('1s');
        }else{
            speech.say("Since you're playing again. I will through sharps and flats into the mix.");
        }

        var notes = 0;

        while(notes < 5){

            do{
                clipIndex = Math.floor(Math.random() * clips.length);
            }while((!newGame && getNHarmoic() != '') || alreadyPlayed());//while it's a sharp or flat

            clipsAlreadyPlayed.push(clipIndex);

            speech.audio('https://s3.amazonaws.com/pianonotes/' + clips[clipIndex])
                  .pause('1s');
                  // .audio('https://s3.amazonaws.com/pianonotes/' + clips[clipIndex])
                  // .pause('1s');

            console.log('https://s3.amazonaws.com/pianonotes/' + clips[clipIndex]);

            var noteName = "That was ";
            var firstLetter = getAnswer()[0];

            if(firstLetter == 'A' || firstLetter == 'E' || firstLetter == 'F'){
                noteName += " an ";
            }else{
                noteName += " a ";
            }

            noteName += getAnswer();

            if(getNHarmoic() != ''){
                noteName += ' or ' + getNHarmoic() + '. ';
            }

            speech.say(noteName)
                  .pause('1s');

            notes++;
        }

        speech.say("Okay there was 5 notes to think about.")
              .say("Would you like to hear 5 more?");

        Object.assign(this.attributes, {
            'speechOutput': speech.ssml(true),
            'repromptText': "Would you like to hear more?"
        });

        this.handler.state = GAME_STATES.LEARN;
        this.emit(':ask', this.attributes['speechOutput'], this.attributes['repromptText']);

        console.log('got to here');

    },
    'AMAZON.YesIntent': function(){
        console.log('they kept going');
        this.emitWithState('StartLearning', true);
    },
    'AMAZON.NoIntent': function(){
        this.emit(':tell', 'See you later.');
    },
    'AMAZON.HelpIntent': function () {
        this.emit(':ask', "I just played some clips for you. Would you like to hear more?", 
                        "Would you like to hear more?");
    },
    'AMAZON.StopIntent': function () {
        console.log('game stopped');
        this.emit(':tell', 'See you later.');
    },
    'Unhandled': function () {
        console.log('unhandled from learn state');
        this.emit(':tell', 'See you later.');
    },
    'SessionEndedRequest': function () {
        console.log(`Session ended in learn state: ${this.event.request.reason}`);
    }
});

const helpStateHandlers = Alexa.CreateStateHandler(GAME_STATES.HELP, {
    'helpUser': function(){
        var response = "";
        var repeat = "";
        if(inGame){
            response = 'All you have to do is wait for me to play a piano note. ' + 
                            'Then when it stops playing, give your answer or say that you don\'t know. ' + 
                            'Would you like to keep playing?';
            repeat = 'Would you like to play?';
        }else{
            response = 'The game has not started yet. Would you like to hear about the two game modes?';
            repeat = 'Would you like to play the game?';
        }
        this.emit(':ask', response, repeat);
    },
    'AMAZON.YesIntent': function(){
        if(inGame){
            this.handler.state = GAME_STATES.GAME;
            this.emit(':ask', this.attributes['repromptText'], this.attributes['repromptText']);
        }else{
            this.handler.state = GAME_STATES.SELECT;
            this.emitWithState('StartSkill', false);
        }
    },
    'AMAZON.NoIntent': function(){
        this.emit(':tell', 'See you.');
    },
    'AMAZON.StopIntent': function () {
        this.emit(':tell', 'See you.');
    },
    'AMAZON.HelpIntent': function () {
        this.emitWithState('helpUser');
    },
    'Unhandled': function () {
        console.log('unhandled in help');
        this.emit(':ask', 'Would you like to play?', 'Would you like to play?');
    },
    'SessionEndedRequest': function () {
        console.log(`Session ended in help state: ${this.event.request.reason}`);
    }
});

exports.handler = function (event, context) {
    const alexa = Alexa.handler(event, context);
    alexa.appId = APP_ID;
    // To enable string internationalization (i18n) features, set a resources object.
    alexa.registerHandlers(newSessionHandlers, gameSelectionHandlers, gameStateHandlers, 
                            learnStateHanders, helpStateHandlers);
    alexa.execute();
};
