/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

// import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as functions from "firebase-functions";
import {Firestore} from "firebase-admin/firestore";
import {initializeApp} from "firebase-admin/app";
import {Storage} from "@google-cloud/storage";
import {onCall} from "firebase-functions/v2/https";

initializeApp();
const firestore = new Firestore();
const storage = new Storage();
const rawVideoBucketName = "buitube-raw-videos";
const videoCollectionId = "videos";

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// todo: grab this from common area. Dupe of video-processing-service/firestore.
export interface Video {
  id?: string,
  uid?: string,
  filename?: string,
  status?: "processing" | "processed",
  title?: string,
  description?: string
}

export interface Roles {
  admin?: boolean,
  uploader?: boolean,
  viewer: boolean,
}


export const createUser = functions.auth.user().onCreate((user) => {
  const userInfo = {
    uid: user.uid,
    email: user.email,
    photoUrl: user.photoURL,
    roles: {
      viewer: false,
    },
  };

  firestore.collection("users").doc(user.uid).set(userInfo);
  logger.info(`User Created!: ${JSON.stringify(userInfo)}`);
});

export const generateUploadUrl = onCall({maxInstances: 1}, async (request) =>{
  // check if user authenticated, return error if not
  if (!request.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  const auth = request.auth;
  const data = request.data; // get the filename
  const bucket = storage.bucket(rawVideoBucketName);

  // create new unique filename
  const fileName = `${auth.uid}-${Date.now()}.${data.fileExtension}`;

  // get a v4 signed URL for uploading file
  const [url] = await bucket.file(fileName).getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + 15 * 60 * 1000, // 15 min
  });

  return {url, fileName};
});

export const getVideos = onCall({maxInstances: 1}, async () => {
  const querySnapshot =
    await firestore.collection(videoCollectionId).limit(10).get();
  return querySnapshot.docs.map((doc) => doc.data());
});

export const updateVideoDetails = onCall({maxInstances: 1}, async (request) => {
  const video: Video = request.data?.video;
  console.log("UPDATING VIDEO DETAILS");
  console.log(video);
  firestore.collection("videos")
    .doc(video?.id as string)
    .set(video, {merge: true});
});
