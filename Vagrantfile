Vagrant.configure("2") do |config|
  config.vm.box = "precise64"
  config.vm.provision "ansible" do |ansible|
    ansible.playbook = "provisioning/playbook.yml"
    ansible.sudo = true
    ansible.verbose = "v"
  end
  config.vm.network :forwarded_port,
               guest: 22,
                host: 2203,
                  id: "ssh",
  auto_correct: true
  #website
  config.vm.network :forwarded_port, host: 4900, guest: 3000

  #websockets
  config.vm.network :forwarded_port, host: 4901, guest: 3001

  #redis port
  config.vm.network :forwarded_port, host: 4679, guest: 6379

  config.vm.network :forwarded_port, host: 4680, guest: 8080

  #redis commander
  config.vm.network :forwarded_port, host: 4681, guest: 8081

  #node-inspector
  config.vm.network :forwarded_port, host: 4632, guest: 5432

  config.vm.provider "virtualbox" do |v|
  	v.customize ["modifyvm", :id, "--natdnshostresolver1", "on"]
    v.customize [ "guestproperty", "set", :id, "/VirtualBox/GuestAdd/VBoxService/--timesync-set-threshold", 500 ]
  end
end