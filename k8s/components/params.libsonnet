{
  global: {
    // User-defined global parameters; accessible to all component and environments, Ex:
    // replicas: 4,
  },
  components: {
    // Component-level parameters, defined initially from 'ks prototype use ...'
    // Each object below should correspond to a component in the components/ directory
    'owner-deployment': {
      replicas: 1,
      limits: {
        cpu: '',
        memory: '',
      },
      requests: {
        cpu: '',
        memory: '',
      },
      nginx: {
        limits: {
          cpu: '',
          memory: '',
        },
        requests: {
          cpu: '',
          memory: '',
        },
      },
      CASSANDRA_ENDPOINTS: '',
      KAFKA_HOST: '',
      MAILGUN_DOMAIN: '',
      GCP_PROJECT: '',
    },
    'rider-deployment': {
      replicas: 1,
      limits: {
        cpu: '',
        memory: '',
      },
      requests: {
        cpu: '',
        memory: '',
      },
      nginx: {
        limits: {
          cpu: '',
          memory: '',
        },
        requests: {
          cpu: '',
          memory: '',
        },
      },
      GCP_PROJECT: '',
      MAILGUN_DOMAIN: '',
      CASSANDRA_ENDPOINTS: '',
      KAFKA_HOST: '',
      BLUE_SNAP_API: '',
      BLUE_SNAP_API_TEST_USER: '',
      BLUE_SNAP_USER_NAME: '',
      BLUE_SNAP_USER_NAME_TEST_USER: '',
      IOS_APP_ID: '',
      RAYVEN_FEEDBACK_TOPIC: '',
      GCP_CREDENTIALS_FILE_NAME: '',
      INVOICES_BUCKET_NAME: '',
    },
  },
}
