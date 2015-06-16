nano = require("nano")("http://hoiredis01:5984")
_ = require('lodash')
pluralize = require('pluralize')
MongoClient = require('mongodb').MongoClient
mongourl = 'mongodb://hoiredis01/hoist-testing'
q = require 'q'

mongo_connection = null

get_mongo_connection = q.fcall () ->
  console.log('getting mongo connection')
  if mongo_connection
    console.log "returning existing mongo connection"
    return mongo_connection
  return q.ninvoke MongoClient, 'connect', mongourl
  .then (connection) ->
    if(mongo_connection)
      console.log "returning existing inner mongo connection"
      connection.close()
      return mongo_connection
    console.log "returning new mongo connection"
    mongo_connection = connection
    return mongo_connection

save_item = (dbname,environment,bucket,item) ->
  console.log("saving item to #{dbname} #{environment} #{bucket}")
  return get_mongo_connection
  .then (connection) ->
    db = connection.db(dbname)
    collectionName = [environment,bucket,pluralize.plural(item._type)].join(':')
    return q.ninvoke db, 'collection', collectionName
    .then (collection) ->
      return q.ninvoke collection, 'insert', item
    .then () ->
      console.log "#{item._id} inserted into mongo"


convert_item = (item) ->
  #throw away couchdb properties
  if(item._id)
    delete item._id
  if(item._rev)
    delete item._rev

  _.forOwn(item,(propertyValue,propertyName) ->
    if(propertyName.indexOf('x_')==0)
      item[propertyName.replace('x_','_')] = propertyValue
      delete item[propertyName]
    )
  return item

load_application = (data_bucket)->
  return get_mongo_connection
  .then (connection) ->
    return q.ninvoke connection, 'collection', 'applications'
    .then (collection) ->
      return q.ninvoke collection, 'findOne', {'dataBucket':data_bucket}
    .then (result) ->
      if(!result)
        console.log "no application for databucket", data_bucket
      return result
  .fail (err) ->
    "failed loading app #{err.message}"
generateSimpleCode = (length)->
  length = length||30
  mask = ''
  mask += 'abcdefghijklmnopqrstuvwxyz'
  result = ''
  for i in [0..length]
    result += mask[Math.round(Math.random() * (mask.length - 1))]
  return result

save_default_environment = (application) ->
  environment = {
    name:'_default',
    isDefault:true,
    slug:'_default',
    order:-1,
    token:generateSimpleCode(10)
  }
  console.log("generated environment",environment)
  application.environments = application.environments || []
  application.environments.push(environment)
  return get_mongo_connection
  .then (connection) ->
    q.ninvoke connection, 'collection', 'applications'
  .then (collection) ->
    return q.ninvoke collection, 'save', application
    .then () ->
      return application


get_mongo_db_name = (database) ->
  parts = database.split('-')
  bucket = 'default'
  dbname = parts[0]
  return load_application dbname
  .then (application) ->
    if(!application)
      return []

    default_environment = _.find application.environments, (env)->
      return env.name == '_default'

    promise = q.fcall () ->
      return application

    if(!default_environment)
      promise = save_default_environment()


    return promise
    .then (application) ->
      if(!default_environment)
        default_environment = _.find application.environments, (env)->
          return env.name == '_default'

      if(parts.length==1)
        environment = default_environment.token
      if(parts.length>1)
        environment_doc = _.find application.environments, (env)->
          return env.token == parts[1]
        #console.log('environment selected',environment_doc)
        environment = default_environment.token
        if(environment_doc)
          console.log('picking found environment over default')
          environment = environment_doc.token
        else
          bucket = parts[1]

      if(parts.length>2)
        bucket = parts[2]
      console.log(database,dbname,environment,bucket)
      return [dbname,environment,bucket]

save_to_mongo =(dbname,environment,bucket,item) ->

  item = convert_item(item)
  return save_item(dbname,environment,bucket,item)

migrate_row = (couch_db, mongo_db_name, environment, bucket, row) ->
  return q.fcall () ->
    #console.log "migrating #{mongo_db_name} #{row.id}"
    return q.ninvoke couch_db, 'get', row.id
    .spread (body)->
      return save_to_mongo(mongo_db_name, environment, bucket,body)
    .fail (err) ->
      console.log "err: #{err.message} #{err.stack}"


migrate_db = (database) ->
  return q.fcall ()->
    db = nano.use(database)
    return q.ninvoke db,'list'
    .spread (body) ->
      #if(body.total_rows==0)
        #console.log("#{ database } has no rows so skipping")

      return if body.total_rows == 0

      return get_mongo_db_name database
      .spread (mongo_db_name, environment, bucket) ->
        if(!mongo_db_name)
          return
        rows = _.filter body.rows, (row)->
          return row.id.indexOf('_design')==-1
        #console.log('mapping migration')
        migrate_all_rows = _.map rows, (row) ->
          return migrate_row(db, mongo_db_name, environment, bucket, row)
          .fail (err)->
            console.log("error #{err.message}")
        return q.allSettled migrate_all_rows

  .fail (err)->
    console.log("failed to migrate #{ database }, #{ err.message }")

delete_database = (name) ->
  return get_mongo_connection
  .then (connection) ->
    db = connection.db(name)
    return q.ninvoke db, 'dropDatabase'

delete_mongo_application_databases = ()->
  return get_mongo_connection
  .then (connection) ->
    admin = connection.admin()
    return q.ninvoke admin, 'listDatabases'
  .then (databases) ->
    delete_databases = _.chain databases.databases
    .map (database) ->
      return database.name
    .filter (name) ->
      return name.indexOf('hoist')==-1
    .map (name) ->
      return delete_database(name)
    .value()
    return q.allSettled(delete_databases)


nano.db.list (err,body)->

  delete_mongo_application_databases()
  .then () ->
    all_dbs_migrated = _.map body, (dbname) ->
      q.fcall ()->
        return migrate_db(dbname)
    return q.allSettled(all_dbs_migrated)
  .then ()->
    console.log "done"
    return get_mongo_connection
    .then (connection)->
      console.log('closing mongo')
      connection.close()

  .done()
