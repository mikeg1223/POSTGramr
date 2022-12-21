/*
=-=-=-=-=-=-=-=-=-=-=-=-
PostGramr
=-=-=-=-=-=-=-=-=-=-=-=-
Student ID: 23866066
Comment (Required):

=-=-=-=-=-=-=-=-=-=-=-=-
*/

const http = require('http');
const https = require('https')
const fs = require('fs');
const queryString = require('node:querystring');
const { URLSearchParams, URL } = require('url');
const { create } = require('domain');
const crypto = require('crypto');
const port = 3000;
const server = http.createServer();

const twitter_permission_cache = "./cache/twitter-permissions-res.json";
const twitter_token_cache = "./cache/twitter-token-res.json";
const gpt3_token_cache = "./cache/gpt3-toke-res.json";

const {client_id, client_secret, scope, redirect_uri} = require("./auth/twitterCredentials.json");
let base64data = Buffer.from(`${client_id}:${client_secret}`).toString('base64');	

const all_sessions = [];

server.on("request", connection_handler);

function connection_handler(req, res){
    console.log(`New Request for ${req.url} from ${req.socket.remoteAddress}`);
    if(req.url === '/' || req.url === "/?"){
        let main = fs.createReadStream(`html/main.html`);
		res.writeHead(200,{'Content-type':'text/html'});
		main.pipe(res);
    }else if(req.url === '/favicon.ico'){
        let favicon = fs.createReadStream(`res/favicon.ico`);
		res.writeHead(200, {'Content-type':'image/x-icon'});
		favicon.pipe(res);
    }else if(req.url === '/res/Banner.jpg'){
        let banner = fs.createReadStream(`res/Banner.jpg`);
		res.writeHead(200, {'Content-type':'image/jpeg'});  
		banner.pipe(res);
    }else if(req.url.startsWith("/tweet")){
        let url = new URL(req.url, "https://localhost:3000")
        let type = url.searchParams.get('type');
        let input = url.searchParams.get('text')
        if(type === null || input === null){
            res.writeHead('404', {"Content-Type":"text/plain"});
            let error_page = fs.createReadStream('html/error.html');
            error_page.pipe(res);
        }else{
            request_twitter_access_token(req, res, type, input);
        }
    }else if(req.url.startsWith("/receive_code")){
        const user_input = new URL(req.url, `https://${req.headers.host}`).searchParams;
        const code = user_input.get("code");
        const state = user_input.get("state");
        let session = all_sessions.find((session) => session.state === state);
        if (code === undefined || state === undefined || session === undefined) {
            res.writeHead('404', {"Content-Type":"text/plain"});
            let error_page = fs.createReadStream('html/error.html');
            error_page.pipe(res);
            return;
        }
        const {type, input} = session;
        create_twitter_access_permission_cache(req, code, session);
        send_twitter_access_token_request(req, res, code, {type, input}, session);
    }else{
        let error_page = fs.createReadStream(`html/error.html`);
		res.writeHead(404,{'Content-type':'text/html'});
		error_page.pipe(res);
    }
}

function request_twitter_access_token(req, res, type, input){
	let cache_invalid = true;
    if(fs.existsSync(twitter_permission_cache)){
		const cache = require(twitter_permission_cache);
        const user_record = cache.users.find((record) => record.ip === req.socket.remoteAddress);
		if(user_record != undefined){
			cache_invalid = false;
            send_twitter_access_token_request(req, res, user_record.code, {type, input}, user_record);
		}
	}
	if(cache_invalid){	
		const state = crypto.randomBytes(20).toString("hex");
        all_sessions.push({state, "ip":req.socket.remoteAddress, type, input});
        redirect_to_twitter(state, res);
	}
}

function redirect_to_twitter(state, res,){
    const auth_endpoint = "https://twitter.com/i/oauth2/authorize";
    let code_challenge = "challenge";
    let code_challenge_method = "plain";
    let uri = new URLSearchParams({"Authorization":"Basic "+base64data,"response_type":"code",client_id,redirect_uri,state,scope,code_challenge, code_challenge_method}).toString();
    res.writeHead(302,{Location:`${auth_endpoint}?${uri}`}).end();
}

function create_twitter_access_permission_cache(req, code, session){
    if(fs.existsSync(twitter_permission_cache)){
        let cache = require(twitter_permission_cache);
        let found = cache.users.find((record)=>record.ip === session.ip);
        if(found === undefined){
            cache.users.push({"ip":session.ip, code, "code_challenge":"challenge"});
            fs.writeFile(twitter_permission_cache, JSON.stringify(cache), (err)=>{if(err)throw err});
        }
    }else{
        fs.writeFile(twitter_permission_cache, JSON.stringify(
            {
                "users":
                [{
                    "ip":session.ip, 
                    code
                }]
            }), 
            (err)=>{if(err)throw err});
    }
}

function stream_to_message(req, res, token_stream, callback, user_input, user_record){
    let body = "";
    token_stream.on("data", chunk => body += chunk)
    token_stream.on("end", ()=>callback(req,res,body, user_input, user_record));
}

function send_twitter_access_token_request(req, res, code, user_input, session){
    let cache_valid = false;
    let user_record;
    if(fs.existsSync(twitter_token_cache)){
        const cache = require(twitter_token_cache);
        user_record = cache.users.find((record) => record.ip === session.ip);
		if(user_record != undefined && new Date(user_record.expiration) > Date.now()){
			cache_valid = true;
		}
    }
    if(cache_valid){
        request_gpt3_suggestion(req, res, user_input, user_record);
        return;
    }
    session.code = code;
    const token_end_point = "https://api.twitter.com/2/oauth2/token";
    const options = {
        method:"POST",
        headers:{
            "Content-Type":"application/x-www-form-urlencoded",
            "Authorization":"Basic "+ base64data
        }
    }
    const post_data = queryString.stringify({
        code,
       "grant_type":"authorization_code",
       client_id,
       redirect_uri,
       "code_verifier":"challenge"
    });
    const twitter_access_req = https.request(token_end_point, options);
    twitter_access_req.on("error", (error)=>{throw error;});
    twitter_access_req.on("response", (token_stream)=>stream_to_message(req,res,token_stream, create_twitter_access_token_cache, user_input, session));
    twitter_access_req.end(post_data);
}

function create_twitter_access_token_cache(req, res, body, user_input, session){
    let twitter_token_auth = JSON.parse(body);
    session.expiration = Date.now()+twitter_token_auth.expires_in*1000;
    session.access_token = twitter_token_auth.access_token;
    session.refresh_token = twitter_token_auth.refresh_token;
    if(fs.existsSync(twitter_token_cache)){
        const cache = require(twitter_token_cache);
        let found = cache.users.find((record)=>record.ip === session.ip);
        if(found === undefined){
            cache.users.push({
                "ip":user_record.ip,
                "access_token":twitter_token_auth.access_token,
                "refresh_token":twitter_token_auth.refresh_token,
                "expiration": session.expiration
            });
        }else{
            found.access_token = twitter_token_auth.access_token;
            found.refresh_token = twitter_token_auth.refresh_token;
            found.expiration = session.expiration;
        }
        fs.writeFileSync(twitter_token_cache, JSON.stringify(cache), (error)=>{throw error;});
    }else{
        fs.writeFileSync(twitter_token_cache, JSON.stringify(
            {
                "users":[{
                    "ip":session.ip,
                    "access_token":twitter_token_auth.access_token, 
                    "refresh_token":twitter_token_auth.refresh_token, 
                    "expiration":session.expiration
            }]}), 
            (error)=>{throw error;});
    }
    request_gpt3_suggestion(req,res,user_input,session);
}

function request_gpt3_suggestion(req, res, user_input, user_record){
    const gpt3_api_end_point = "https://api.openai.com/v1/completions";
    const openAI_secret = require("./auth/openAICredentials.json");
    const options = {
        method:"POST",
        headers:{
            "Content-Type":"application/json",
            "Authorization":openAI_secret.Authorization
        }        
    }
    let prompt;
    if(user_input.type === "Grammer"){
        prompt = "Correct my Grammer: " + user_input.input;
    }else if(user_input.type === "Formal"){
        prompt = "Make this more formal: " + user_input.input;
    }else{
        prompt = "Write me a statement about: " + user_input.input;
    }
    const post_data = JSON.stringify({
        "model":"text-davinci-003",
        prompt,
        "max_tokens": 280,
        "temperature":0.6
    });
    let gpt3_req = https.request(gpt3_api_end_point, options);
    gpt3_req.on("error", (err)=>{throw err});
    gpt3_req.once("response",(token_stream)=>stream_to_message(req, res, token_stream, received_GPT3_response, user_input,user_record));
    gpt3_req.end(post_data);
}

function received_GPT3_response(req, res, data, user_input, user_record){
    const gpt3_response_parsed = JSON.parse(data);
    const gpt3_text_edit = gpt3_response_parsed.choices[0].text;
    post_tweet(req,res, gpt3_text_edit, user_record);
}

function post_tweet(req, res, tweet, user_record){

    const tweet_end_point = "https://api.twitter.com/2/tweets";
    const options = {
        method : "POST",
        headers : {
            "Content-Type":"application/json",
            "Authorization": "Bearer " + user_record.access_token
        }
    }
    const post_data = JSON.stringify({
        "text":tweet
    });
    const twitter_request = https.request(tweet_end_point, options);
    twitter_request.on("error", (err)=>{throw err;});
    twitter_request.once("response", (token_stream)=>stream_to_message(req, res, token_stream, tweet_posted, user_record));
    twitter_request.end(post_data);
}

function tweet_posted(req, res, body, user_record){
    let response = JSON.parse(body);
    console.log(response);
    if(response.status !== undefined || response.errors !== undefined){
        let error = fs.createReadStream(`html/error.html`);
        res.writeHead(404,{'Content-type':'text/html'});
        error.pipe(res);
        return;
    }
    let success = fs.createReadStream(`html/success.html`);
    res.writeHead(200,{'Content-type':'text/html'});
    success.pipe(res);
}

server.on("listening", listening_handler);
function listening_handler(){
	console.log(`Now Listening on Port ${port}`);
}

server.listen(port);