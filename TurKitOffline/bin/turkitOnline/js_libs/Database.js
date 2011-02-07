
/**
 * Resets the database.
 */
function resetDatabase(){
    print("deleting HITs created in this TurKit script...")
    foreach(ensure(__db, ["hits"]), function(hitRecord, hitId){
        props.mode = hitRecord.mode
        mturkBase.deleteHIT(hitId)
    })
    
    print("clearing db...")
    db = {}
    __db = {}
    
    print("done")
}
