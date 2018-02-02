'use strict';

const Alexa = require('alexa-sdk');

const GAME_STATES = {
    TRIVIA: '_TRIVIAMODE', // Asking trivia questions.
    START: '_STARTMODE', // Entry point, start the game.
    // HELP: '_HELPMODE', // The user is asking for help.
};
const APP_ID = undefined; // TODO replace with your app ID (OPTIONAL)

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

// function sayHello(){
//     this.emit(':tell', "Hello there, my name is chief asshole");
// }

const startStateHandlers = Alexa.CreateStateHandler(GAME_STATES.START, {
    'StartGame': function (newGame) {
        
        // sayHello();
        this.emit(':tell', "Hello there friend");

    },
});

const triviaStateHandlers = Alexa.CreateStateHandler(GAME_STATES.TRIVIA, {
    'HelloIntent': function () {
        handleUserGuess.call(this, false);
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
    alexa.registerHandlers(newSessionHandlers, startStateHandlers, triviaStateHandlers);
    alexa.execute();
};
