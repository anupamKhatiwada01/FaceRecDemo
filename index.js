require('dotenv').config();

// const DetectFaceExtract = require('./DetectFaceExtract.js');

// console.log(process.env['FRD_KEY']);
const msRest = require("@azure/ms-rest-js");
const Face = require("@azure/cognitiveservices-face");
// const uuid = require("uuid/v4");
const { v4: uuidv4 } = require('uuid');

const cred = {
  key: process.env.FRD_KEY,
  endpoint: process.env.FRD_ENDPOINT
}

// Authenticate the client
const credentials = new msRest.ApiKeyCredentials({ inHeader: { 'Ocp-Apim-Subscription-Key': cred.key } });
const client = new Face.FaceClient(credentials, cred.endpoint);

// console.log(cred)
const image_base_url = "https://csdx.blob.core.windows.net/resources/Face/Images/";


/*
  There is a package issue with the uuid package. The version and function call shown in the method doesn't work. From the uuid package documentation in npm we see
the proper way to import the package and call the method as shown below. 
*/
const person_group_id = uuidv4();

// We use the below method for the training of the PersonGroup to complete
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


async function DetectFaceExtract() {
    console.log("========DETECT FACES========");
    console.log();

    // Create a list of images
    const image_file_names = [
        "detection1.jpg",    // single female with glasses
        // "detection2.jpg", // (optional: single man)
        // "detection3.jpg", // (optional: single male construction worker)
        // "detection4.jpg", // (optional: 3 people at cafe, 1 is blurred)
        "detection5.jpg",    // family, woman child man
        "detection6.jpg"     // elderly couple, male female
    ];

// NOTE await does not work properly in for, forEach, and while loops. Use Array.map and Promise.all instead.
    await Promise.all (image_file_names.map (async function (image_file_name) {
        let detected_faces = await client.face.detectWithUrl(image_base_url + image_file_name,
            {
                returnFaceAttributes: ["Accessories","Age","Blur","Emotion","Exposure","FacialHair","Glasses","Hair","HeadPose","Makeup","Noise","Occlusion","Smile","QualityForRecognition"],
                // We specify detection model 1 because we are retrieving attributes.
                detectionModel: "detection_01",
                recognitionModel: "recognition_03"
            });
        console.log (detected_faces.length + " face(s) detected from image " + image_file_name + ".");
        console.log("Face attributes for face(s) in " + image_file_name + ":");

// Parse and print all attributes of each detected face.
        detected_faces.forEach (async function (face) {
            // Get the bounding box of the face
            console.log("Bounding box:\n  Left: " + face.faceRectangle.left + "\n  Top: " + face.faceRectangle.top + "\n  Width: " + face.faceRectangle.width + "\n  Height: " + face.faceRectangle.height);

            // Get the accessories of the face
            let accessories = face.faceAttributes.accessories.join();
            if (0 === accessories.length) {
                console.log ("No accessories detected.");
            }
            else {
                console.log ("Accessories: " + accessories);
            }

            // Get face other attributes
            console.log("Age: " + face.faceAttributes.age);
            console.log("Blur: " + face.faceAttributes.blur.blurLevel);

            // Get emotion on the face
            let emotions = "";
            let emotion_threshold = 0.0;
            if (face.faceAttributes.emotion.anger > emotion_threshold) { emotions += "anger, "; }
            if (face.faceAttributes.emotion.contempt > emotion_threshold) { emotions += "contempt, "; }
            if (face.faceAttributes.emotion.disgust > emotion_threshold) { emotions +=  "disgust, "; }
            if (face.faceAttributes.emotion.fear > emotion_threshold) { emotions +=  "fear, "; }
            if (face.faceAttributes.emotion.happiness > emotion_threshold) { emotions +=  "happiness, "; }
            if (face.faceAttributes.emotion.neutral > emotion_threshold) { emotions +=  "neutral, "; }
            if (face.faceAttributes.emotion.sadness > emotion_threshold) { emotions +=  "sadness, "; }
            if (face.faceAttributes.emotion.surprise > emotion_threshold) { emotions +=  "surprise, "; }
            if (emotions.length > 0) {
                console.log ("Emotions: " + emotions.slice (0, -2));
            }
            else {
                console.log ("No emotions detected.");
            }
            
            // Get more face attributes
            console.log("Exposure: " + face.faceAttributes.exposure.exposureLevel);
            if (face.faceAttributes.facialHair.moustache + face.faceAttributes.facialHair.beard + face.faceAttributes.facialHair.sideburns > 0) {
                console.log("FacialHair: Yes");
            }
            else {
                console.log("FacialHair: No");
            }
            console.log("Glasses: " + face.faceAttributes.glasses);

            // Get hair color
            var color = "";
            if (face.faceAttributes.hair.hairColor.length === 0) {
                if (face.faceAttributes.hair.invisible) { color = "Invisible"; } else { color = "Bald"; }
            }
            else {
                color = "Unknown";
                var highest_confidence = 0.0;
                face.faceAttributes.hair.hairColor.forEach (function (hair_color) {
                    if (hair_color.confidence > highest_confidence) {
                        highest_confidence = hair_color.confidence;
                        color = hair_color.color;
                    }
                });
            }
            console.log("Hair: " + color);

            // Get more attributes
            console.log("Head pose:");
            console.log("  Pitch: " + face.faceAttributes.headPose.pitch);
            console.log("  Roll: " + face.faceAttributes.headPose.roll);
            console.log("  Yaw: " + face.faceAttributes.headPose.yaw);
 
            console.log("Makeup: " + ((face.faceAttributes.makeup.eyeMakeup || face.faceAttributes.makeup.lipMakeup) ? "Yes" : "No"));
            console.log("Noise: " + face.faceAttributes.noise.noiseLevel);

            console.log("Occlusion:");
            console.log("  Eye occluded: " + (face.faceAttributes.occlusion.eyeOccluded ? "Yes" : "No"));
            console.log("  Forehead occluded: " + (face.faceAttributes.occlusion.foreheadOccluded ? "Yes" : "No"));
            console.log("  Mouth occluded: " + (face.faceAttributes.occlusion.mouthOccluded ? "Yes" : "No"));

            console.log("Smile: " + face.faceAttributes.smile);

            console.log("QualityForRecognition: " + face.faceAttributes.qualityForRecognition)
            console.log();
        });
    }));
}


async function AddFacesToPersonGroup(person_dictionary, person_group_id) {
    console.log ("Adding faces to person group...");
    // The similar faces will be grouped into a single person group person.
    
    await Promise.all (Object.keys(person_dictionary).map (async function (key) {
        const value = person_dictionary[key];

        // Wait briefly so we do not exceed rate limits.
        await sleep (1000);

        let person = await client.personGroupPerson.create(person_group_id, { name : key });
        console.log("Create a person group person: " + key + ".");

        // Add faces to the person group person.
        await Promise.all (value.map (async function (similar_image) {
            // Check if the image is of sufficent quality for recognition.
            let sufficientQuality = true;
            let detected_faces = await client.face.detectWithUrl(image_base_url + similar_image,
                {
                    returnFaceAttributes: ["QualityForRecognition"],
                    detectionModel: "detection_03",
                    recognitionModel: "recognition_03"
                });
            detected_faces.forEach(detected_face => {
                if (detected_face.faceAttributes.qualityForRecognition != 'high'){
                    sufficientQuality = false;
                }
            });

            // Quality is sufficent, add to group.
            if (sufficientQuality){
                console.log("Add face to the person group person: (" + key + ") from image: " + similar_image + ".");
                await client.personGroupPerson.addFaceFromUrl(person_group_id, person.personId, image_base_url + similar_image);
            }
        }));
    }));

    console.log ("Done adding faces to person group.");
}




async function main(){
  await DetectFaceExtract();
  console.log("DONE");
}

main();
// console.log(client);