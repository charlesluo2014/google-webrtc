function test() {
    var constraints = {video: true};
    navigator.mozGetUserMedia(constraints, handleUserMedia, handleUserMediaError);
}
function handleUserMedia(stream) {
    console.log('Adding local stream.');
}

function handleUserMediaError(error){
    console.log('getUserMedia error: ', error);
}
