var request = require('request');
var crequest = require('cached-request')(request);
var cli = require('cli');
var _ = require('underscore');
var async = require('async');
var TelegramBot = require('node-telegram-bot-api');

var token = process.env.TELEGRAM_BOT_TOKEN || null;
var hostero_api_url = 'https://api.hostero.eu/v1/';

// Create a bot that uses 'polling' to fetch new updates
var bot = new TelegramBot(token, {
  polling: true
});

crequest.setCacheDirectory('tmp');

bot.onText(/\/help/, (msg, match) => {
  var chatId = msg.chat.id;
  var resp = '⚙️ You can run the following commands: \n\n';

  resp += '\t /help - Shows this message \n';
  resp += '\t /coins - Shows a list with coins \n';
  resp += '\t /calculator [hashrate] - Shows profitability for hashrate \n\n';

  resp += '🔗 Useful links:\n\n';
  resp += '\t - [Website](https://www.hostero.eu) \n';
  resp += '\t - [Install on Ubuntu](https://www.hostero.eu/docs/install-on-ubuntu) \n';
  resp += '\t - [Install on Windows](https://www.hostero.eu/docs/install-on-windows) \n';
  resp += '\t - [Install on MacOS](https://www.hostero.eu/docs/install-on-macos) \n';

  bot.sendMessage(chatId, resp, {
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
    disable_notification: true,
  });
});

bot.onText(/\/coins/, (msg, match) => {
  var chatId = msg.chat.id;
  var resp = '📁 The complete directory of [CPU Mineable Coins](https://www.hostero.eu/cpu-mineable-coins): \n\n';

  crequest({
    url: hostero_api_url + 'coins',
    ttl: 3600 * 1000 * 24,
    timeout: 1000 * 10
  }, function(err, message, body) {
    var data;

    try {
      data = JSON.parse(body);
    } catch (e) {
      console.error(e);
      return;
    }

    _.each(data, function(coin) {
      resp += '\t';

      if (coin.on_hostero) {
        resp += ' ✅ ';
      } else {
        resp += ' ❎ ';
      }

      resp += '[' + coin.name + '](https://www.hostero.eu/coins/' + coin.internal_name + ') ';

      if (coin.cmc_url) {
        resp += '([' + coin.short_name + '](' + coin.cmc_url + '))';
      } else {
        resp += '(' + coin.short_name + ')';
      }

      resp += ' - _' + coin.description + '_';

      resp += '\n\n';
    });

    resp += '_Legend:_\n\n';
    resp += '✅ _is minable with_ [Hostero](https://www.hostero.eu) \n';
    resp += '❎ _is not yet minable with_ [Hostero](https://www.hostero.eu) \n\n';

    bot.sendMessage(chatId, resp, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
      disable_notification: true,
    });
  });
});

bot.onText(/\/calculator (.+)/, (msg, match) => {
  var chatId = msg.chat.id;
  var hashrate = 0;
  var resp = '🤑 Profitability calculator for [CPU Mineable Coins](https://www.hostero.eu/cpu-mineable-coins).';

  if (match.length > 0 && parseInt(match[1])) {
    hashrate = parseInt(match[1]);
  } else {
    bot.sendMessage(chatId, 'Please format hashrate as an integer', {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
      disable_notification: true,
    });

    return;
  }

  resp += ' Showing calculations for ' + hashrate + ' H/s: \n\n';

  crequest({
    url: hostero_api_url + 'coins',
    ttl: 3600 * 1000 * 24,
    timeout: 1000 * 10
  }, function(err, message, body) {
    var data;

    try {
      data = JSON.parse(body);
    } catch (e) {
      console.error(e);
      return;
    }

    _.each(data, function(coin) {
      if (coin.price_eur && coin.network_hashrate && coin.block_time && coin.block_reward) {
        var reward = 0;

        // DOMINANCE = USER_HASHES / GLOBAL_HASHES / * 100
        // REWARD_PER_DAY = BLOCK_REWARD * 3600 * 24 / BLOCK_TIME * DOMINANCE / 100
        var dominance = hashrate / coin.network_hashrate / 100;
        var reward_coins = coin.block_reward * 3600 * 24 / coin.block_time * dominance * 100;

        reward = coin.price_eur * reward_coins;

        if (coin.hybrid) {
          reward = reward * coin.hybrid_percentage_pow / 100;
        }

        coin.reward = reward.toFixed(2);
      }

      if (coin.reward) {
        resp += '[' + coin.name + '](https://www.hostero.eu/coins/' + coin.internal_name + ') - ' + coin.reward + ' € / day';
        resp += '\n';
      }
    });

    resp += '\n*Note:* _Each coin can have a different hashrate on the same computer_';

    bot.sendMessage(chatId, resp, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
      disable_notification: true,
    });
  });
});
