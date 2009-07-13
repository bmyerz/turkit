
mturk.deleteHITsRaw(database.query("return keys(ensure('__HITs'))"))

foreach(database.query("return keys(ensure('__S3_Objects'))"), function (obj) {
    s3.deleteObjectRaw(obj)
})
