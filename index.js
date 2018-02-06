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

function isCorrect(userAnswer){
    var correctAnswer = clips[clipIndex].answer;
    return userAnswer.toLowerCase() == correctAnswer.toLowerCase();
}

function handleUserGuess(userDoesntKnow){
    var response = "";
    //user doesn't know
    if(userDoesntKnow){
        //emit the answer
        response = 'The note was';
        if(clips[clipIndex].answer[0] == 'A'){
            response += ' an ';
        }else{
            response += ' a ';
        }
        response += clips[clipIndex].answer + '. Maybe you\'ll know this one. ';
        
    }else{ //user answered, so check it

        var userAnswer = this.event.request.intent.slots.Answer.value;

        if(isCorrect(userAnswer)){
            response = 'You\'re right! ';
            score++;
        }else{
            response = 'Sorry. It was actually';
            if(clips[clipIndex].answer[0] == 'A'){
                response += ' an ';
            }else{
                response += ' a ';
            }
            response += clips[clipIndex].answer + '. ';
        }

        console.log('User Answer: ' + userAnswer);
        console.log('Correct Answer: ' + clips[clipIndex].answer);

    }
    
    if(clipsPlayed < gameLength){
        response += 'Now try this note. ';

        clipIndex = Math.floor(Math.random() * clips.length);

        var audioClip = new Speech();
        audioClip.audio('https://s3.amazonaws.com/pianonotes/' + clips[clipIndex].name);

        console.log('Audio clip: https://s3.amazonaws.com/pianonotes/' + clips[clipIndex].name);

        Object.assign(this.attributes, {
            'speechOutput': 'What note was that?',
            'audioClip': audioClip.ssml(true),
            'repromptText': 'Just guess a note.'
        });

        this.emit(':ask', response + this.attributes['audioClip'] + this.attributes['speechOutput']
                        ,this.attributes['repromptText']);

        clipsPlayed++;
    }else{
        this.emit(':tell', response + "You've reached the end. You got " + score + " right out of " + 
                           gameLength + " notes.");
    }

}

const startStateHandlers = Alexa.CreateStateHandler(GAME_STATES.START, {
    'StartGame': function (newGame) {

        clipIndex = Math.floor(Math.random() * clips.length);

        var audioClip = new Speech();
        audioClip.audio('https://s3.amazonaws.com/pianonotes/' + clips[clipIndex].name);

        console.log('Audio clip: https://s3.amazonaws.com/pianonotes/' + clips[clipIndex].name);

        Object.assign(this.attributes, {
            'speechOutput': 'What note was that?',
            'audioClip': audioClip.ssml(true),
            'repromptText': 'Just guess a note.'
        });

        this.handler.state = GAME_STATES.GAME;
        this.emit(':ask', "Hello. I'm going to play you " + gameLength + " notes on the piano. " + 
                        "You just have to guess the note that was played. Let's see how you do." + 
                        this.attributes['audioClip'] + this.attributes['speechOutput'], 
                        this.attributes['repromptText']);

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
        this.emit(':ask', this.attributes['audioClip'], this.attributes['repromptText']);
    },
    'AMAZON.StopIntent': function () {
        console.log('game stopped');
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
