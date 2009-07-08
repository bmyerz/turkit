
mturk.deleteHITsRaw(database.query("return keys(__HITs)"))

foreach(database.query("return keys(__S3_Objects)"), function (obj) {
    s3.deleteObjectRaw(obj)
})
