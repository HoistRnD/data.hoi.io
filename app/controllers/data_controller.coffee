
hoist = require 'hoist-core'
Model= hoist.data.Model
throat = require 'throat'
User=hoist.models.User
DataRuleCollection=hoist.models.DataRuleCollection
ruleRunner=hoist.data.ruleRunner
errors=require '../platform/errors'
_=require 'underscore'
q=hoist.q

class DataController
  getCurrentUser:(request) ->
    #no user logged in
    return q.fcall(()->) unless (request.session &&
      request.session.passport &&
      request.session.passport.member)
    return q.fcall(()->
      return User.findByIdQ(request.session.passport.member.userId)
      .then((user) ->
        hoist.logger.debug 'there is a current user', JSON.stringify(user)
        return {
          _id: request.session.passport.member._id,
          email: user.emailAddresses[0].address,
          name: user.name,
          role: request.session.passport.member.defaultRole
        }))

  runDataRules:(request,allDataRules) =>
    #return an array of touples (entity and rule ids to apply)
    rulesToRun  = _.map(request.boundData.entities,(entity) ->
      return {
        entity:entity,
        rules:_.chain(allDataRules.runLists)
          #find run list for this entity or for all entities
          .filter((runList) ->
            return (
              runList.model.toLowerCase() == entity._type.toLowerCase() ||
                runList.model.toLowerCase() == 'all')
            )
            #apply the update rules
          .map((runList) -> return runList.onUpdate)
          .flatten().value()
        })
    loadUser = @getCurrentUser(request)
    rulesRunFuncs = _.map(rulesToRun,(ruleToRun)=>
      hoist.logger.debug 'running rules'
      @validateEntity(request,loadUser,ruleToRun,allDataRules.rules))
    return q.allSettled(rulesRunFuncs)

  loadExistingEntity:(request,entity) ->
    #no entity id so can't load anything existing
    return q.fcall(()->) if !entity._id
    return request.dataStore.get(entity._type, entity._id)

  validateEntity:(request,loadUser,ruleListToRun,allRules) =>
    #no rules to run so pass
    return q.fcall(()->) if !ruleListToRun.rules
    return q.fcall(()->) if ruleListToRun.rules.length<1
    return q.all([@loadExistingEntity(request,ruleListToRun.entity),loadUser])
    .spread((existingEntity,user)->
      return q.all(_.chain(allRules)
      .filter((rule) ->
        #only run enabled rules and those listed to run against this entity
        return rule.enabled &&_.some(ruleListToRun.rules, (id) ->
          return id.equals(rule._id)
        )
      )
        #run them in the order specified
      .sortBy((rule) -> return rule.order)
      .map(throat 2, (rule) ->
        #run the rule
        ruleFn = "function(model,existing,user){" + rule.rule + "}"
        u = 'none'
        if(user)
          u = JSON.stringify(user)
        hoist.logger.debug('running rule',rule.name,ruleFn,u)
        return ruleRunner.run(
          ruleFn, ruleListToRun.entity, existingEntity, user
        )
        .then((result) ->
          if (!result)
            error = new Error()
            error.rule = rule.name
            error.entity = JSON.stringify(ruleListToRun.entity)
            throw error
        )
      ).value())
    )

  applyDataRules:(request) =>

    #if no data rules return nothing
    application = request.application
    environment = request.environment

    return q.fcall(()->) if !environment.dataRules
    return DataRuleCollection
      .findByIdQ(environment.dataRules)
      .then((dataRulesCollection)=>@runDataRules(request,dataRulesCollection))

  checkValidationResults:(validationResults) ->
    validationResults = validationResults || []
    failedChecks = _.filter(validationResults, (validationResult) ->
      return validationResult.state == 'rejected';
      )
    if (failedChecks && failedChecks.length > 0)
      error = new errors.Data.RulesFailed("One or more data rules failed")
      error.failures = _.chain(failedChecks).map((check) ->
        return {
          rule: check.reason.rule,
          entity: check.reason.entity
        })
        .flatten().value()
      throw error
  saveEntities:(req) ->
    return q.allSettled(
      _.map(req.boundData.entities,(entity) ->
        return req.dataStore.save(entity)
        ))
        .then((results)->
          return _.chain(results).map((result)->
            return result.value
            ).flatten().value()
          )

  ping: (req, res) ->
    res.send({
      ok: true,
      node: process.env.NODE_NAME,
      port: process.env.PORT
    })

  post: (req, res) =>
    member = req.session.passport.member
    bucket = req.session.passport.bucket
    environment = req.environment
    application = req.application

    hoist.auth.helpers.data.canWrite(member,environment,bucket)
    .then (allowed) =>

      throw new errors.request.Forbidden("User doesn't have permissions to write data") if !allowed
      return @applyDataRules(req)
    .then (results) =>
      return @checkValidationResults(results)
    .then () =>
      return @saveEntities(req)
    .then (savedEntities) ->
      saveSuccessful = _.every(savedEntities,(entity)->return entity._saved)
      statusCode = 200
      statusCode = 403 if !saveSuccessful
      if(savedEntities.length==1)
        savedEntities = savedEntities[0]
      res.send(statusCode,savedEntities)

    .catch (err) ->
      if (!err.resCode)
        hoist.error(err, req, req.application)
        err = new errors.server.ServerError()
      response = {
        message:err.message
      }
      if err.failures
        response.failures = err.failures
      res.send(err.resCode || 500, response)
    .done()

  get: (req, res) ->
    member = req.session.passport.member
    bucket = req.session.passport.bucket
    environment = req.environment
    hoist.auth.helpers.data.canRead(member,environment,bucket)
    .then (allowed) ->
      throw new errors.request.Forbidden("User doesn't have permissions to read data") if !allowed
      query = {}
      if(req.query.skip)
        query.skip = req.query.skip
      if(req.query.limit)
        query.limit = req.query.limit
      if(req.query.q)
        query.q = JSON.parse(req.query.q)
      if(req.query.sort)
        query.sort = JSON.parse(req.query.sort)

      return req.dataStore.get(req.dataParams._type,req.dataParams._id,query)

    .then (entity) ->
      if !entity
        throw new errors.request.NotFound("Data item doesn't exist")
        return
      res.send(200,entity)

    .catch (err) ->
      if (!err.resCode)
        hoist.error(err, req, req.application)
        err = new errors.server.ServerError()
      res.send(err.resCode || 500, err.message)

    .done()


  delete: (req, res) ->
    member = req.session.passport.member
    bucket = req.session.passport.bucket
    environment = req.environment
    application = req.application
    hoist.auth.helpers.data.canDelete(member,environment,bucket)
    .then (allowed) ->
      throw new errors.request.Forbidden("User doesn't have permissions to delete data") if !allowed
      req.dataStore.delete(req.dataParams._type, req.dataParams._id)
    .then((numberOfRemovedDocs)->
      if(numberOfRemovedDocs.length&&numberOfRemovedDocs.length>1)
        numberOfRemovedDocs = numberOfRemovedDocs[0];
      res.send({status:"ok",removed:numberOfRemovedDocs})
    )
    .catch((err) ->
      if (!err.resCode)
        hoist.error(err, req, req.application)
        err = new errors.server.ServerError()
      res.send(err.resCode || 500, err.message)
    ).done()

module.exports = new DataController()
