import { Application } from 'express';
import { Config } from 'apollo-server-core';
import { ApolloServer } from 'apollo-server-express';
import {
  mocks,
  schemaDirectives,
  resolvers,
  typeDefs
} from '../../graphql/setupSchema';
import * as bodyParser from 'body-parser';
import { formatError } from 'apollo-errors';
const expressJwt = require('express-jwt');
import * as fs from 'fs';
const DataLoader = require('dataloader');
import {
  fetchPeopleWithPlanet,
  fetchPeople,
  fetchPlanet,
  fetchStarship
} from '../../graphql/dataloader/starwars';

// Tracing Configuration
const tracing =
  process.env.GRAPHQL_TRACING !== undefined &&
  process.env.GRAPHQL_TRACING === 'true'
    ? true
    : false;

const getGraphQLConfig = (): Config => {
  // Data Loaders with Batch and Cache Enabled
  const peopleLoader = new DataLoader(keys =>
    Promise.all(keys.map(fetchPeople))
  );
  const planetLoader = new DataLoader(keys =>
    Promise.all(keys.map(fetchPlanet))
  );
  const starshipLoader = new DataLoader(keys =>
    Promise.all(keys.map(fetchStarship))
  );
  const peopleWithPlanetLoader = new DataLoader(keys =>
    Promise.all(keys.map(fetchPeopleWithPlanet))
  );
  const getuser = req => {
    if (process.env.JWT_AUTH === 'true') {
      return req.user ? req.user : Promise.resolve('');
    }
  };
  const serverMocks =
    process.env.GRAPHQL_MOCK !== undefined &&
    process.env.GRAPHQL_MOCK === 'true'
      ? mocks
      : false;

  return {
    typeDefs,
    resolvers,
    schemaDirectives,
    mocks: serverMocks,
    formatError, // Error Handler
    tracing,
    introspection: true,
    context: async ({ req, connection }) => {
      if (connection) {
        // check connection for metadata
        return {};
      } else {
        const user = getuser(req);
        return {
          // Setup the user context as well as the dataload context
          user,
          peopleLoader,
          planetLoader,
          starshipLoader,
          peopleWithPlanetLoader
        };
      }
    }
  };
};
/**
 * Configure GraphQL endpoints
 * @param app Express Application
 */

export const configGraphQL = (app: Application): ApolloServer => {
  // If JWT Auth is enabled added JWT header verification for all graphql
  // calls
  if (process.env.JWT_AUTH === 'true') {
    const RSA_PUBLIC_KEY = fs.readFileSync(process.env.RSA_PUBLIC_KEY_FILE);
    // If a valid Bearer token is present the req.user object is set
    // set those details in the context.user
    // The context can then be used by the resolvers to validate user credentials
    app.use(
      '/graphql',
      bodyParser.json(),
      expressJwt({ secret: RSA_PUBLIC_KEY, credentialsRequired: false })
    );
  }

  const server = new ApolloServer(getGraphQLConfig());
  const path = '/graphql';
  server.applyMiddleware({ app, path, gui: true });

  return server;
};
