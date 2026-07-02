class SessionsController < ApplicationController
  allow_unauthenticated_access only: %i[new create]
  rate_limit to: 10, within: 3.minutes, only: :create, with: lambda {
    redirect_to new_session_path, alert: 'Try again later.'
  }

  def new; end

  def create
    if (user = User.authenticate_by(params.permit(:email, :password)))
      sign_in user
      redirect_to after_authentication_url
    else
      redirect_to new_session_path, alert: 'Try another email address or password.'
    end
  end

  def destroy
    sign_out
    redirect_to new_session_path, status: :see_other
  end
end
