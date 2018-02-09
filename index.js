'use strict';

const Alexa = require('alexa-sdk');
var Speech = require('ssml-builder');

const GAME_STATES = {
    GAME: '_GAMEMODE', // Asking trivia questions.
    START: '_STARTMODE', // Entry point, start the game.
    // HELP: '_HELPMODE', // The user is asking for help.
};

const APP_ID = undefined; // TODO replace with your app ID (OPTIONAL)

var clips = require('./clips').clips;

var score = 0;
var clipIndex;
var gameLength = 5;
var clipsPlayed = 0;

const newSessionHandlers = {
    'LaunchRequest': function () {
        this.handler.state = GAME_STATES.START;
        this.emitWithState('StartGame', true);
    },
    'AMAZON.StartOverIntent': function () {
        this.handler.state = GAME_STATES.START;
        this.emitWithState('StartGame', true);
    },
    // 'AMAZON.HelpIntent': function () {
    //     this.handler.state = GAME_STATES.HELP;
    //     this.emitWithState('helpTheUser', true);
    // },
    'Unhandled': function () {
        console.log('unhandled event');
    },
};

function getNHarmoic(){ //n harmonic means 2 names, same note C# == Db for instance
    var answer = getAnswer();
    if(answer.length == 1){
        return '';
    }
    switch(answer[0]){
        case 'C':
            return 'D flat';
        case 'D':
            return 'E flat';
        case 'F':
            return 'G flat';
        case 'G':
            return 'A flat';
        case 'A':
            return 'B flat';
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
        speech.say(response)
              .pause('1s')
              .say("Maybe you will know this one.");

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
    
    if(clipsPlayed <= gameLength){

        speech.say('Now try this note.')
              .pause('1s');

        clipIndex = Math.floor(Math.random() * clips.length);

        speech.audio('https://s3.amazonaws.com/pianonotes/' + clips[clipIndex])
              .say('What note was that?');

        //repeat speech
        var repeat = new Speech();
        repeat.say("Here is the note again.")
              .audio('https://s3.amazonaws.com/pianonotes/' + clips[clipIndex]);

        console.log('Audio clip: https://s3.amazonaws.com/pianonotes/' + clips[clipIndex]);

        Object.assign(this.attributes, {
            'speechOutput': speech.ssml(true),
            'repromptText': repeat.ssml(true)
        });

        this.emit(':ask', this.attributes['speechOutput'], this.attributes['repromptText']);

        clipsPlayed++;
    }else{
        this.emit(':tell', this.attributes['speechOutput'] + "You've reached the end. You got " + score + " right out of " + 
                           gameLength + " notes.");
    }

}

const startStateHandlers = Alexa.CreateStateHandler(GAME_STATES.START, {
    'StartGame': function (newGame) {

        clipsPlayed = 0;
        score = 0;

        clipIndex = Math.floor(Math.random() * clips.length);

        var speech = new Speech();
        speech.say("Hello. I am going to play you " + gameLength + " notes on the piano.")
              .say('You just have to guess the note that was played.')
              .say("Let's see how you do.")
              .audio('https://s3.amazonaws.com/pianonotes/' + clips[clipIndex])
              .say('What note was that?');
        
        var repeat = new Speech();
        repeat.say("Here is the note again.")
              .audio('https://s3.amazonaws.com/pianonotes/' + clips[clipIndex]);

        console.log('Audio clip: https://s3.amazonaws.com/pianonotes/' + clips[clipIndex]);

        Object.assign(this.attributes, {
            'speechOutput': speech.ssml(true),
            'repromptText': repeat.ssml(true)
        });

        this.handler.state = GAME_STATES.GAME;
        this.emit(':ask', this.attributes['speechOutput'], this.attributes['repromptText']);

        clipsPlayed++;

    },
});

const gameStateHandlers = Alexa.CreateStateHandler(GAME_STATES.GAME, {
    'AnswerIntent': function () {
        handleUserGuess.call(this, false);
    },
    'DontKnowIntent': function () {
        handleUserGuess.call(this, true);
    },
    'AMAZON.RepeatIntent': function () {
        this.emit(':ask', this.attributes['repromptText'], this.attributes['repromptText']);
    },
    'AMAZON.StopIntent': function () {
        console.log('game stopped');
        this.emit(':tell', 'See you later.');
    },
    'Unhandled': function () {
        console.log('unhandled from trivia state');
    },
    'SessionEndedRequest': function () {
        console.log(`Session ended in trivia state: ${this.event.request.reason}`);
    },
});

exports.handler = function (event, context) {
    const alexa = Alexa.handler(event, context);
    alexa.appId = APP_ID;
    // To enable string internationalization (i18n) features, set a resources object.
    alexa.registerHandlers(newSessionHandlers, gameStateHandlers, startStateHandlers);
    alexa.execute();
};
