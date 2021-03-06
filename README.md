# file-storage-node
##### Author: JJ

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

### POST /upload

Used to upload a file via a multipart form request. Response is JSON containing the download URL.

Example: curl -v -F file=@/tmp/test2.txt -F password=password https://localhost:3000/upload

### GET /upload_form.html

A static html file providing a form that will hit /upload

### GET /download?filekey=\[filekey\]&password=\[password\]

Used to download a previously uploaded file, replace \[filekey\] with the filekey and \[password\] with the password. The /stat endpoint should be used to verify the sha1 of the file.

### GET /stat?filekey=\[filekey\]

Used to get statistics for the uploaded file. Response is JSON. Currently supports the file's sha1.

## TODO
 - After we have SSL, change /download to a POST request
 - Write clean up script to delete files older than 1 day - we can do this by just checking the file's timestamp. (Redis already expires data after a day.)

## Scalability
 - The existing implementation should be able to handle multiple uploads and downloads at once unless we end up with the same filekey (right now a md5sum of the file name, uploader ip and time). This problem can be solved by doing a quick check with Redis to see if a filekey is in use. To scale further we can spin up multiple machines (load balanced) with a shared file system (maybe nfs? but I bet there are better technologies out there) or we could move file storage off to some central machine (or even a cluster with replication), at which point our concern will be with our network as our frontends hit our file servers.
 - Large files have not been sufficiently tested on this app, but work will need to happen to properly support large file downloads so that we can resume from a partial download in the case of a broken connection. The user should be able to specify from what to what byte they would like.

## Resiliency
 - Work needs to be done here too. At the moment we return a relevant status code but we could improve error responses. More testing of error cases needs to be done here too.
 - There are possible race conditions because of redis expiring data and the unimplemented file clean up script. The idea is to return 410 (resource gone) in all these cases. I believe this is implemented, but more testing it necessary.
 - I also want to make asynchronous the file encryption and sha1 generation. This will allow for faster responses but the trade off is that a user could upload a file and share the download link and the link won't work (yet). This is a design decision.


