# file-storage-node
### Author: JJ

This app may be used to share files via a url. A user may upload a file with a password and get a corresponding URL. He may then share the URL and password with a separate user who can perform a query to the server to download the uploaded file.

The file is stored encrypted via AES using the provided password. It will only be available for the next 24 hours, at which point the app will start returning 410 (resource gone).

This app was written with Node.js using the Express framework, and uses Redis for storage of meta data.

## Prerequisites

### Install Redis

To install either use your package manager or check
out http://redis.io

Only the redis-server binary is required but the redis-cli binary may be useful
for debugging.

### Install Node.js and npm

Install either using your package manager or check out https://nodejs.org/

## Starting your server

To install all Node.js dependencies run (in the project root): npm install 

Start redis by: redis-server
Start the app: node file-storage-node.js

## API

### /upload

Used to upload a file via a multipart form request. Response is JSON containing the download URL.

Example: curl -v -F file=@/tmp/test2.txt -F password=password https://localhost:3000/upload

### /upload_form.html

A static html file providing a form that will hit /upload

### /download?filekey=[filekey]&password=[password]

Used to download a previously uploaded file, replace [filekey] with the filekey and [password] with the password.  

#### /stat?filekey=[filekey]

Used to get statistics for the uploaded file. Response is JSON. Currently supports the file's sha1.

## TODO
 - Use SSL
 - After we have SSL, change /download to a POST request
 - Write clean up script to delete files older than 1 day.



