export const deleteFile = async (url: string) => {
  //delete the image form upload-file server
  return fetch(
    `${process.env.UPLOAD_LOCAL_BASE_API}/api/v1/manage/delete?url=${url}`,
    { method: "delete" }
  ).catch(reason => console.log("Unable to delete the file", reason));
};
