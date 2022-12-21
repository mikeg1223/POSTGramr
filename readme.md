# POSTGramr

POSTGramr is a node based website with static front end components. POSTGramr's purpose is display knowledge of node.js backend components, API calls, HTTP protocol, Observer pattern design, and Socket communication. 

## How to run POSTGramr:
1. Register for a developer account on GPT3, and add your key information to the file /auth/openAiCredentials.json
2. Register for a developer account on Twitter.
3. Create a project on twitter and navigate to User Authentication settings
4. Set the App Permissions to Read and Write
5. Set Type of App to Web App, Automated App, or Bot
6. Add the following URI's:
    http://127.0.0.1:3000/twitter_token , 
    http://127.0.0.1/twitter_token , 
    http://127.0.0.1:3000 , 
    http://127.0.0.1/receive_code , 
    http://127.0.0.1:3000/receive_code , 
    http://127.0.0.1
7. Set the website URL to be the direct link to the twitter profile connected to your developer account.
8. Go back to the App details page for your project and navigate to the Keys and Tokens tab
9. Generate an OAuth2.0 clientID and clientSecret
10. Store both of the generated keys in the corresponding fields /auth/twitterCredentials.json
11. Ensure that node.js is installed on your computer. 
12. From command line in the root of this project write "node index.js" and hit enter, this starts the server.
13. From a browser navigate to http://localhost:3000

## What does POSTGramr do?
Post grammer will post tweets on your behalf. You provide POSTGramr with text and choose whether to fix it's grammer, make it more formal, or auto complete it. On the request the users twitter will authenticate either by cache or fresh approval from the user. Then the message will be sent to GPT3 for processing with prepended instructions depending on the augmentation option. Once the data is received from GPT3 the tweet is posted on behalf of the user ("if the tweet is not too long")
