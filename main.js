
// ----------------
// modules

// const storage = require('node-persist')
const TelegramBot = require('node-telegram-bot-api')
const commandLineArgs = require('command-line-args')
const markdownEscape = require('markdown-escape')
const marked = require('marked')
const { MongoClient } = require("mongodb");
var http = require('http');
var fs = require('fs');
var path = require('path');

let database, users, template;

// ----------------
// marked renderer options for telegram HTML

const markedRenderer = new marked.Renderer()

markedRenderer.paragraph = (text) => `\n\n${text}`
markedRenderer.list = (text) => `\n${text}`
markedRenderer.listitem = (text) => `\n- ${text}`

// Connection URI
const uri =
  "mongodb+srv://ochui:QJth0Uw6No0XYaYU@cluster0.wzgi1.gcp.mongodb.net?retryWrites=true&w=majority";
// Create a new MongoClient
const client = new MongoClient(uri);
// ----------------
// command line arguments

const DEFAULT_PERSISTENCE_PATH = './.persistence'

const optionDefinitions = [
  { name: 'api-token', alias: 't', type: String },
  { name: 'bot-username', alias: 'u', type: String },
  { name: 'persistence-path', alias: 'p', type: String }
]

const options = commandLineArgs(optionDefinitions)

if (!options['api-token']) throw new Error('❌   The --api-token (-t) option is required!')
if (!options['bot-username']) throw new Error('❌   The --bot-username (-u) option is required!')
if (!options['persistence-path']) console.warn(`⚠️   No --persistence-path (-p) defined, the default will be used: ${DEFAULT_PERSISTENCE_PATH}`)

// ----------------
// constants

// bot info
const API_TOKEN = options['api-token']
const BOT_USERNAME = options['bot-username']
const PERSISTENCE_PATH = options['persistence-path'] || DEFAULT_PERSISTENCE_PATH
const BOT_ID = +API_TOKEN.split(':')[0]

// built-in messages
const ERROR_MESSAGE_PREFIX = '⚠️ *Beep, boop, error!*'

const DEFAULT_MSG_TEMPLATE = `
Hi *$safeusername*, Welcome to iSatoshi Verse.

iSatoshi Verse is an educational crypto group.

We host quizzes❓, Rewards💰, and weekly AMA, KYI Sessions.

We aren't like any other AMA group out there, iSatoshi Verse brings the goodies right to your doorstep.

We don't just host AMA for Crypto Projects but we also conduct KYI Session with Influencers and Top Individuals in the Crypto Industry.

👉 KYI(Know Your Influencers):
iSatoshi Verse invites top Influencers and individuals in the crypto space to share their experiences with the iVerse Community. This way the community members ask questions and learn from the experiences of these successful individuals.

🌎 iSatoshi Verse always has special goodies 🎁 for;

👉 1. Most active members of the Universe 🏆 (iVerse King🤴/ Queen👸) -- 500$

👉 2. Members who gets the most answers on AMA and Quiz every month 🏅(iVerse Nobel Men 👨‍💼/ Women👩‍💼) -- 500$

👉 3. Member with the highest AMA project / Influencer Referrals (iVerse Lord🦸‍♂) -- 1000$

👉 4. Most active members on Twitter 🏆 (Tweet King🤴/ Queen👸) -- 200$ [You can win by tweeting about iSatoshi Verse, Retweeting post and engaging in tweets]

👉 5. Most active members of on Reddit 🏆 (Red King🤴/ Queen👸) -- 200$ [You can win by upvoting iSatoshi Verse, Reposting post and engaging in tweets]

👉 6. Member that has the most claps and interactions on our medium page (iVerse Meduim Lord/Dame) -- 200$


Adding to its 🍹juicy incentive plan.

👉 Our Referral Program ✨

Any member that refers a project for AMA on iSatoshi Verse will get a 10% commission 🤑

👉 iSatoshi Verse Free 📺 Adsday

On Wednesdays every week iSatoshi Verse will help place two free ads for our loyal members on its channels (Twitter, Telegram, Medium etc.) for Zero Fee.

In our Universe we want to give back to the crypto community, The Satoshians 💪

Contact @iSatohi_MasterRoy  for partnership, offers and to start up iSatoshi Verse in your local community

Follow On;

Website: https://isatoshi.org/

Twitter: https://twitter.com/iSatoshi_Verse

Reddit: https://www.reddit.com/user/isatoshiVerse/

Meduim: https://medium.com/@iSatoshiVerse

Contact: contact@isatoshi.netcontact@isatoshi.netcontact@isatoshi.net

If you would love to join our private investors group for free fill the form: https://forms.gle/qkk3Mi4tWjbyoa8c7 ; at the iSatoshi investors group you get access to early project seed and private rounds.

Glad To Have You Join Us 🤩
`

const START_MSG = 'Add me to a group! :)'

const INTRO_MSG = `👋 Hi!

I will send a welcome message to everyone in this group from now on.

To customize the message, use the command \`/change_welcome_message <your new message>\`.

You can use the following templates:

- \`$$username\`: the new member's username (example: $username)
- \`$$safeusername\`: the username, but if it isn't defined by the user, the first name will be used instead (example: $safeusername)
- \`$$firstname\`: the new member's first name (example: $firstname)
- \`$$groupname\`: the group's name (example: $groupname)

IMPORTANT: \`$username\` could fail if the user hasn't defined a username, and when that happens the resulting string will be \`@undefined\`. Because of this, it is recommended to use \`$safeusername\` instead.

Keep in mind that *only* the user who introduced me to this group ($username) can execute this command.

This bot created by @Appless_Machine

Enjoy! 😊`

const HELP_MSG = `*Welcome message bot help*

I will send a welcome message to every new member of a group.

I will start as soon as I get added to a group.

To customize the message, use the command \`/change_welcome_message <your new message>\`.

You can use the following templates:

- \`$username\`: the new member's username (with the @ character)
- \`$safeusername\`: the username, but if it isn't defined by the user, the first name will be used instead
- \`$firstname\`: the new member's first name
- \`$groupname\`: the group's name

IMPORTANT: \`$username\` could fail if the user hasn't defined a username, and when that happens the resulting string will be \`@undefined\`. Because of this, it is recommended to use \`$safeusername\` instead.

Keep in mind that *only* the user who introduces me to a group can execute this command.

This bot created by @Appless_Machine


Enjoy! 😊`

// ----------------
// bot instance

const bot = new TelegramBot(API_TOKEN, { polling: true })

// ----------------
// message composers

const composeMessage = (msg, member, groupname) => msg
  .replace(/([^$])(\$username)/g, (full, pre) => `${pre}@${markdownEscape(member.username)}`)
  .replace(/([^$])(\$firstname)/g, (full, pre) => `${pre}${markdownEscape(member.first_name)}`)
  .replace(/([^$])(\$groupname)/g, (full, pre) => `${pre}${markdownEscape(groupname)}`)
  .replace(/([^$])(\$safeusername)/g, (full, pre) => member.username
    ? `${pre}@${markdownEscape(member.username)}`
    : `${pre}@${markdownEscape(member.first_name)}`)
  // remove extra "$" in $$username / $$firstname / $$groupname
  .replace(/\$\$(username|safeusername|firstname|groupname)/g, (full, match) => `$${markdownEscape(match)}`)

const composeIntroMessage = (owner, groupName) => composeMessage(INTRO_MSG, owner, groupName)

const composeErrorMessage = msg => `${ERROR_MESSAGE_PREFIX} ${msg}`

// ----------------
// helpers

const sendMessage = (chatId, msg) => bot.sendMessage(chatId, marked(msg, { renderer: markedRenderer }), { parse_mode: 'HTML' })

const sendErrorMessage = (chatId, msg) => sendMessage(chatId, composeErrorMessage(msg))

const isGroup = msg => ['group', 'supergroup'].indexOf(msg.chat.type) > -1

// ----------------
// data

// message template
const msgTemplates = {}

const getMsgTemplateKey = chatId => `${chatId}_msg_template`

const getMsgTemplate = async chatId => {
  // already loaded in memory
  if (msgTemplates[chatId]) return msgTemplates[chatId]

  // persisted
  const storedTemplate = () => {

    client.connect((err, client) => {
      const database = client.db("welcome_bot");
      const template = database.collection("templates");

      var msgt = template.findOne({ key: getMsgTemplateKey(chatId) })

      console.log(msgt);
      // client.close();
      return msgt;
    });
    // await template.findOne({key: getMsgTemplateKey(chatId)})

  }
  if (storedTemplate) {
    msgTemplates[chatId] = storedTemplate // load in memory
    return storedTemplate
  }

  // not initialized
  msgTemplates[chatId] = DEFAULT_MSG_TEMPLATE
  return DEFAULT_MSG_TEMPLATE
}

const setMsgTemplate = (chatId, msgTemplate) => {
  const doc = { key: getMsgTemplateKey(chatId), message: msgTemplate };

  client.connect((err, client) => {
    const database = client.db("welcome_bot");
    const template = database.collection("templates");

    template.insertOne(doc)
    console.log("Inserted successfully to server", doc);
    // client.close();
  });


  msgTemplates[chatId] = msgTemplate
}

const removeMsgTemplate = chatId => {
  delete msgTemplates[chatId]

  client.connect((err, client) => {
    const database = client.db("welcome_bot");
    const template = database.collection("templates");

    template.deleteOne({ key: `${chatId}_msg_template` })
    console.log("deleted successfully to server");
    // client.close();
  });
}

// owner id
const getOwnerIdKey = chatId => `${chatId}_owner_id`

// const getOwnerId = async (chatId) => {
//   client.connect(async (err, client) => {
//     const database = client.db("welcome_bot");
//     const users = database.collection("users");
//     const uu = await users.findOne({ key: getOwnerIdKey(chatId) });

//     console.log("+++++++++++++", uu);
//     // client.close();
//     return uu;
//   });
// }

const setOwnerId = async (chatId, ownerId) => {

  var uul;
  client.connect((err, client) => {
    const users = client.db("welcome_bot").collection("users");
    uul = users.insertOne({ key: getOwnerIdKey(chatId), message: ownerId });
    
  });

  // client.close();

  return uul;


}

const removeOwnerId = (chatId) => {


  var dl;
  client.connect((err, client) => {
    const users_d = client.db("welcome_bot").collection("users");
    dl = users_d.deleteOne({ key: getOwnerIdKey(chatId) });
    // client.close();
  });

  return dl;

}

// ----------------
// handlers

const notGroupHandler = async msg => sendMessage(msg.chat.id, '*Add me to a group first!*')

const newMemberHandler = async msg => {
  const chatId = msg.chat.id
  const groupName = msg.chat.title
  const newMember = msg.new_chat_members[0]

  if (newMember.id === BOT_ID) {
    await sendMessage(chatId, composeIntroMessage(msg.from, groupName))
    return setOwnerId(chatId, msg.from.id)
  } else if (!newMember.is_bot) return sendMessage(chatId, composeMessage(await getMsgTemplate(chatId), newMember, groupName))
}

const memberLeftHandler = async msg => {
  const chatId = msg.chat.id
  const member = msg.left_chat_member // oh, I 'member!

  if (member.id === BOT_ID) {
    await removeOwnerId(chatId)
    await removeMsgTemplate(chatId)
  }
}

const changeWelcomeMessageHandler = async (msg, match) => {
  if (!isGroup(msg)) return notGroupHandler(msg)

  const chatId = msg.chat.id
  const groupName = msg.chat.title
  const owner = msg.from

  // var ownerId; //= await getOwnerId(chatId)
  // getOwnerId(chatId).then(function(re) {
  //   console.log('--', re, owner)
  // })

  client.connect(async (err, client) => {
    const database = client.db("welcome_bot");
    const users = database.collection("users");
    const ownerId = await users.findOne({ key: getOwnerIdKey(chatId) });


    console.log(ownerId, owner)

    if (owner.id !== ownerId.message) return sendErrorMessage(chatId, 'Only the user who introduced me to this group can change the message!')
  
    const msgTemplate = match[1].trim()
  
    if (!msgTemplate.length) return changeWelcomeMessageEmptyHandler(msg)
  
    await setMsgTemplate(chatId, msgTemplate)
  
    const exampleMessage = composeMessage(msgTemplate, owner, groupName)
    return sendMessage(chatId, `✔️ New welcome message set! Here's an example:\n\n${exampleMessage}`)
  });

 
}

const changeWelcomeMessageEmptyHandler = msg => {
  if (!isGroup(msg)) return notGroupHandler(msg)

  return sendErrorMessage(msg.chat.id, `You can't set an empty message!`)
}

const helpHandler = msg => {
  // don't send the message if only the /help command is used
  // on a group without the bot's mention appended
  const mentionRegExp = new RegExp(`\\/help@${BOT_USERNAME}`)
  const withMention = !!msg.text.match(mentionRegExp)
  if (isGroup(msg) && !withMention) return

  return sendMessage(msg.chat.id, HELP_MSG)
}

const startHandler = msg => {
  // don't send the message on a group
  if (isGroup(msg)) return

  return sendMessage(msg.chat.id, START_MSG)
}

// ----------------
// execution




var server_port = 5000 || process.env.PORT || 80;
var server_host = '127.0.0.1' || '0.0.0.0';


http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/html'});
  res.write('Hello World!');
  res.end();
}).listen(server_port, server_host, function() {
  const run = async () => {
    // await storage.init({ dir: PERSISTENCE_PATH })
  
    // client.connect((err, client) => {
    //   const collection = client.db("welcome_bot").collection("templates");
    //   // perform actions on the collection object
    //   collection.insertOne({ key: '213s', message: '99' });
    //   client.close();
    // });

    console.log("Starting Bot")
  
    // send welcome message to new members (or intro message)
    bot.on('new_chat_members', newMemberHandler)
  
    // if bot leaves the group, remove its info
    bot.on('left_chat_member', memberLeftHandler)
  
    // change welcome message
  
    const baseChangeMsgCommandRegExp = `\\/change_welcome_message(?:@${BOT_USERNAME})?`
  
    // change the message on request
    const changeMsgCommandRegExp = new RegExp(`${baseChangeMsgCommandRegExp}\\s([\\s\\S]+)`)
    bot.onText(changeMsgCommandRegExp, changeWelcomeMessageHandler)
  
    // detect empty messages in command
    const changeMsgCommandRegExpEmpty = new RegExp(`${baseChangeMsgCommandRegExp}$`)
    bot.onText(changeMsgCommandRegExpEmpty, changeWelcomeMessageEmptyHandler)
  
    // display help message
    const helpCommandRegExp = new RegExp(`\\/help(?:@${BOT_USERNAME})?`)
    bot.onText(helpCommandRegExp, helpHandler)
  
    // answer to start command
    bot.onText(/\/start/, startHandler)
  }
  
  run()
  
  console.log('Listening on port %d', server_port);
});